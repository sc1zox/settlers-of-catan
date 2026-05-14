import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  ActionRejectCode,
  DevCardType,
  DiceRollDto,
  DiceRolledPayload,
  DescribeErrorMessage,
  GameDeltaType,
  GamePhase,
  GameSocketServerEvent,
  KnownLobbyId,
  PlayerSeat,
  ResourceType,
  TileType,
  formatSocketIoLobbyRoomId,
  type GameDeltaPayload,
  type LobbyFullStatePayload,
  type LobbyJoinedPayload,
} from '@catan/api-interfaces';
import { Server } from 'socket.io';
import { GameActionValidationService } from './game-action-validation.service';
import { LobbyRuntime } from './lobby-runtime';
import { makeTileKey } from './board-topology';
import { resolveHarborRates } from './harbor-rate.util';
import { applyRobberMove } from './robber.util';
import {
  consumeDevCard,
  getTotalVictoryPoints,
  recomputeLargestArmy,
  recomputeLongestRoad,
  recomputeWinner,
} from './scoring.util';

function asRejectCode(message: string): ActionRejectCode {
  const values = Object.values(ActionRejectCode) as string[];
  for (let i = 0; i < values.length; i++) {
    if (values[i] === message) {
      return message as ActionRejectCode;
    }
  }
  return ActionRejectCode.WrongPhase;
}

const TURN_ORDER: readonly PlayerSeat[] = [
  PlayerSeat.North,
  PlayerSeat.East,
  PlayerSeat.South,
  PlayerSeat.West,
];

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);
  private readonly lobbies = new Map<string, LobbyRuntime>();

  public constructor(private readonly validation: GameActionValidationService) {}

  public getOrCreateLobby(lobbyId: string): LobbyRuntime {
    let lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      lobby = new LobbyRuntime(lobbyId);
      this.lobbies.set(lobbyId, lobby);
    }
    return lobby;
  }

  public getLobby(lobbyId: string): LobbyRuntime | undefined {
    return this.lobbies.get(lobbyId);
  }

  public joinLobby(
    lobbyId: string,
    sessionToken: string,
    displayName: string,
    socketId: string,
  ): { lobby: LobbyRuntime; joined: LobbyJoinedPayload } {
    const lobby = this.getOrCreateLobby(lobbyId);
    const player = lobby.findPlayerByToken(sessionToken);
    if (!player) {
      let seat;
      try {
        seat = lobby.addPlayer(sessionToken, displayName, socketId);
        if (lobby.adminSessionToken === null) {
          lobby.adminSessionToken = sessionToken;
        }
        this.fillDemoLobbyWithBots(lobby);
      } catch {
        throw new BadRequestException(ActionRejectCode.LobbyFull);
      }
      return {
        lobby,
        joined: { lobbyId, seat },
      };
    }
    lobby.clearDisconnectTimer(player);
    player.socketId = socketId;
    this.fillDemoLobbyWithBots(lobby);
    return {
      lobby,
      joined: { lobbyId, seat: player.seat },
    };
  }

  public toFullState(lobby: LobbyRuntime, viewerSessionToken: string): LobbyFullStatePayload {
    const players = lobby.players.map((p) => ({
      seat: p.seat,
      displayName: p.displayName,
      isConnected: p.socketId !== null,
      isSelf: p.sessionToken === viewerSessionToken,
      resources: { ...p.resources },
      devCardsInHand: p.devCards.length,
      playedKnights: p.playedKnights,
      visibleVictoryPoints: p.visibleVictoryPoints,
      totalVictoryPoints: getTotalVictoryPoints(p),
      longestRoadLength: p.longestRoadLength,
      harborRates: resolveHarborRates(lobby, p.seat),
    }));
    return {
      lobbyId: lobby.lobbyId,
      phase: lobby.fsm.getPhase(),
      currentSeat: lobby.currentSeat,
      adminSeat: this.resolveAdminSeat(lobby),
      seed: lobby.seed,
      tiles: lobby.tiles,
      vertexIds: Array.from(lobby.verticesById.keys()),
      edgeIds: Array.from(lobby.edgesById.keys()),
      settlements: lobby.settlements.map((settlement) => ({ ...settlement })),
      roads: lobby.roads.map((road) => ({ ...road })),
      robberCoord: { ...lobby.robberCoord },
      pendingRobberDiscardSeats: lobby.pendingRobberDiscardSeats.slice(),
      pendingSetupRoadSeat: lobby.pendingSetupRoadSeat,
      pendingSetupRoadFromVertexId: lobby.pendingSetupRoadFromVertexId,
      lastDiceRoll: lobby.lastDiceRoll ? { ...lobby.lastDiceRoll } : null,
      longestRoadSeat: lobby.longestRoadSeat,
      largestArmySeat: lobby.largestArmySeat,
      winnerSeat: lobby.winnerSeat,
      devDeckCount: lobby.devDeck.length,
      players,
    };
  }

  public broadcastFullState(server: Server, lobby: LobbyRuntime): void {
    for (let i = 0; i < lobby.players.length; i++) {
      const p = lobby.players[i];
      if (p.socketId) {
        server
          .to(p.socketId)
          .emit(GameSocketServerEvent.FullState, this.toFullState(lobby, p.sessionToken));
      }
    }
  }

  public onDisconnect(sessionToken: string, server: Server): void {
    for (const lobby of this.lobbies.values()) {
      const player = lobby.findPlayerByToken(sessionToken);
      if (!player) {
        continue;
      }
      player.socketId = null;
      lobby.startDisconnectHold(player, 60_000, () => {
        this.logger.warn(`grace period ended for ${sessionToken} in ${lobby.lobbyId}`);
      });
      this.broadcastFullState(server, lobby);
      return;
    }
  }

  public buildSettlement(
    lobbyId: string,
    sessionToken: string,
    vertexId: string,
    server: Server,
  ): GameDeltaPayload {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      throw new Error(ActionRejectCode.UnknownLobby);
    }
    this.assertLobbyOpen(lobby);
    this.validation.assertPhase(lobby, [
      GamePhase.SetupForward,
      GamePhase.SetupBackward,
      GamePhase.Building,
    ]);
    const player = this.validation.assertCurrentPlayer(lobby, sessionToken);
    const phase = lobby.fsm.getPhase();
    const isSetupPhase = phase === GamePhase.SetupForward || phase === GamePhase.SetupBackward;
    if (isSetupPhase && lobby.pendingSetupRoadSeat !== null) {
      throw new Error(ActionRejectCode.WrongPhase);
    }
    this.validation.assertLegalSettlementVertex(lobby, player, vertexId, !isSetupPhase);
    if (phase === GamePhase.Building) {
      this.validation.assertSettlementCost(player);
      this.validation.deductSettlementCost(player);
    }
    lobby.settlements.push({ seat: player.seat, vertexId, isCity: false });
    player.visibleVictoryPoints += 1;
    if (isSetupPhase) {
      if (phase === GamePhase.SetupBackward) {
        lobby.pendingSetupResourceSeat = player.seat;
        lobby.pendingSetupResourceFromVertexId = vertexId;
      }
      lobby.pendingSetupRoadSeat = player.seat;
      lobby.pendingSetupRoadFromVertexId = vertexId;
    }
    const delta: GameDeltaPayload = {
      type: GameDeltaType.SettlementBuilt,
      seat: player.seat,
      vertexId,
    };
    recomputeWinner(lobby, player.seat);
    server.to(formatSocketIoLobbyRoomId(lobbyId)).emit(GameSocketServerEvent.GameDelta, delta);
    this.broadcastFullState(server, lobby);
    return delta;
  }

  public buildRoad(
    lobbyId: string,
    sessionToken: string,
    edgeId: string,
    server: Server,
  ): GameDeltaPayload {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      throw new Error(ActionRejectCode.UnknownLobby);
    }
    this.assertLobbyOpen(lobby);
    this.validation.assertPhase(lobby, [
      GamePhase.SetupForward,
      GamePhase.SetupBackward,
      GamePhase.Building,
    ]);
    const player = this.validation.assertCurrentPlayer(lobby, sessionToken);
    const phase = lobby.fsm.getPhase();
    const isSetupPhase = phase === GamePhase.SetupForward || phase === GamePhase.SetupBackward;
    if (isSetupPhase) {
      if (lobby.pendingSetupRoadSeat !== player.seat || lobby.pendingSetupRoadFromVertexId === null) {
        throw new Error(ActionRejectCode.IllegalPlacement);
      }
      this.validation.assertLegalRoadEdge(
        lobby,
        player,
        edgeId,
        lobby.pendingSetupRoadFromVertexId,
      );
    } else {
      this.validation.assertRoadCost(player);
      this.validation.assertLegalRoadEdge(lobby, player, edgeId);
      this.validation.deductRoadCost(player);
    }
    lobby.roads.push({ seat: player.seat, edgeId });
    recomputeLongestRoad(lobby);
    if (isSetupPhase) {
      if (
        phase === GamePhase.SetupBackward &&
        lobby.pendingSetupResourceSeat === player.seat &&
        lobby.pendingSetupResourceFromVertexId !== null
      ) {
        this.grantSetupResourceFromSettlement(
          lobby,
          lobby.pendingSetupResourceSeat,
          lobby.pendingSetupResourceFromVertexId,
        );
        lobby.pendingSetupResourceSeat = null;
        lobby.pendingSetupResourceFromVertexId = null;
      }
      lobby.pendingSetupRoadSeat = null;
      lobby.pendingSetupRoadFromVertexId = null;
      if (phase === GamePhase.SetupForward) {
        this.applySetupForwardTransition(lobby, player.seat);
      } else {
        this.applySetupBackwardTransition(lobby, player.seat);
      }
    }
    const delta: GameDeltaPayload = {
      type: GameDeltaType.RoadBuilt,
      seat: player.seat,
      edgeId,
    };
    recomputeWinner(lobby, player.seat);
    server.to(formatSocketIoLobbyRoomId(lobbyId)).emit(GameSocketServerEvent.GameDelta, delta);
    this.broadcastFullState(server, lobby);
    return delta;
  }

  public startLobby(lobbyId: string, sessionToken: string, server: Server): void {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      throw new Error(ActionRejectCode.UnknownLobby);
    }
    const player = lobby.findPlayerByToken(sessionToken);
    if (!player) {
      throw new Error(ActionRejectCode.PlayerNotInLobby);
    }
    if (lobby.adminSessionToken !== sessionToken) {
      throw new Error(ActionRejectCode.NotYourTurn);
    }
    if (lobby.players.length < 2) {
      throw new Error(ActionRejectCode.IllegalPlacement);
    }
    lobby.fsm.onLobbyStarted();
    lobby.currentSeat = this.firstTurnSeat(lobby);
    lobby.settlements.length = 0;
    lobby.roads.length = 0;
    lobby.setupPlacementsBySeat = lobby.createSeatCounter(0);
    lobby.pendingSetupRoadSeat = null;
    lobby.pendingSetupRoadFromVertexId = null;
    lobby.pendingSetupResourceSeat = null;
    lobby.pendingSetupResourceFromVertexId = null;
    lobby.longestRoadSeat = null;
    lobby.largestArmySeat = null;
    lobby.winnerSeat = null;
    const desert = lobby.tiles.find((tile) => tile.number === null);
    if (desert) {
      lobby.robberCoord = { q: desert.coord.q, r: desert.coord.r };
    }
    for (let i = 0; i < lobby.players.length; i += 1) {
      const slot = lobby.players[i];
      const empty = lobby.emptyResourceBag();
      slot.resources = empty;
      slot.devCards = [];
      slot.playedKnights = 0;
      slot.visibleVictoryPoints = 0;
      slot.longestRoadLength = 0;
      slot.hasLongestRoad = false;
      slot.hasLargestArmy = false;
    }
    lobby.lastDiceRoll = null;
    lobby.pendingRobberDiscardSeats = [];
    this.broadcastFullState(server, lobby);
  }

  public rollDice(
    lobbyId: string,
    sessionToken: string,
    server: Server,
  ): DiceRolledPayload {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      throw new Error(ActionRejectCode.UnknownLobby);
    }
    this.assertLobbyOpen(lobby);
    this.validation.assertPhase(lobby, [GamePhase.Rolling]);
    const player = this.validation.assertCurrentPlayer(lobby, sessionToken);
    const roll = this.createDiceRoll();
    lobby.lastDiceRoll = roll;
    const payload: DiceRolledPayload = {
      lobbyId,
      rollerSeat: player.seat,
      roll,
    };
    server.to(formatSocketIoLobbyRoomId(lobbyId)).emit(GameSocketServerEvent.DiceRolled, payload);
    if (roll.sum === 7) {
      lobby.pendingRobberDiscardSeats = this.collectRobberDiscardSeats(lobby);
      lobby.fsm.onDiceResolved(true, lobby.pendingRobberDiscardSeats.length > 0);
      this.broadcastFullState(server, lobby);
      return payload;
    }
    this.applyResourceProduction(lobby, roll.sum);
    lobby.pendingRobberDiscardSeats = [];
    lobby.fsm.onDiceResolved(false, false);
    this.broadcastFullState(server, lobby);
    return payload;
  }

  public submitRobberDiscard(
    lobbyId: string,
    sessionToken: string,
    discard: Readonly<Partial<Record<ResourceType, number>>>,
    server: Server,
  ): void {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      throw new Error(ActionRejectCode.UnknownLobby);
    }
    this.assertLobbyOpen(lobby);
    this.validation.assertPhase(lobby, [GamePhase.RobberDiscard]);
    const player = lobby.findPlayerByToken(sessionToken);
    if (!player) {
      throw new Error(ActionRejectCode.PlayerNotInLobby);
    }
    if (!lobby.pendingRobberDiscardSeats.includes(player.seat)) {
      throw new Error(ActionRejectCode.WrongPhase);
    }
    const expected = lobby.requiredRobberDiscardCount(player);
    let actual = 0;
    const resourceKeys = Object.values(ResourceType);
    for (let i = 0; i < resourceKeys.length; i += 1) {
      const resource = resourceKeys[i];
      const amount = discard[resource] ?? 0;
      if (amount < 0 || !Number.isInteger(amount)) {
        throw new Error(ActionRejectCode.IllegalPlacement);
      }
      if ((player.resources[resource] ?? 0) < amount) {
        throw new Error(ActionRejectCode.InsufficientResources);
      }
      actual += amount;
    }
    if (actual !== expected) {
      throw new Error(ActionRejectCode.IllegalPlacement);
    }
    for (let i = 0; i < resourceKeys.length; i += 1) {
      const resource = resourceKeys[i];
      const amount = discard[resource] ?? 0;
      if (amount > 0) {
        player.resources[resource] = (player.resources[resource] ?? 0) - amount;
      }
    }
    lobby.pendingRobberDiscardSeats = lobby.pendingRobberDiscardSeats.filter(
      (seat) => seat !== player.seat,
    );
    if (lobby.pendingRobberDiscardSeats.length === 0) {
      lobby.fsm.onDiscardRoundResolved();
    }
    this.broadcastFullState(server, lobby);
  }

  public moveRobber(
    lobbyId: string,
    sessionToken: string,
    q: number,
    r: number,
    victimSeat: PlayerSeat | undefined,
    server: Server,
  ): void {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      throw new Error(ActionRejectCode.UnknownLobby);
    }
    this.assertLobbyOpen(lobby);
    this.validation.assertPhase(lobby, [GamePhase.RobberMove]);
    const actor = this.validation.assertCurrentPlayer(lobby, sessionToken);
    applyRobberMove(lobby, actor, q, r, victimSeat);
    lobby.fsm.onRobberMoved();
    this.broadcastFullState(server, lobby);
  }

  public finishTrading(lobbyId: string, sessionToken: string, server: Server): void {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      throw new Error(ActionRejectCode.UnknownLobby);
    }
    this.assertLobbyOpen(lobby);
    this.validation.assertPhase(lobby, [GamePhase.Trading]);
    this.validation.assertCurrentPlayer(lobby, sessionToken);
    lobby.fsm.onTradingFinished();
    this.broadcastFullState(server, lobby);
  }

  public endTurn(lobbyId: string, sessionToken: string, server: Server): void {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      throw new Error(ActionRejectCode.UnknownLobby);
    }
    this.assertLobbyOpen(lobby);
    this.validation.assertPhase(lobby, [GamePhase.Building]);
    this.validation.assertCurrentPlayer(lobby, sessionToken);
    lobby.currentSeat = this.nextSeat(lobby, lobby.currentSeat);
    lobby.lastDiceRoll = null;
    lobby.pendingRobberDiscardSeats = [];
    lobby.fsm.onTurnEnded();
    this.broadcastFullState(server, lobby);
  }

  public buildCity(lobbyId: string, sessionToken: string, vertexId: string, server: Server): void {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      throw new Error(ActionRejectCode.UnknownLobby);
    }
    this.assertLobbyOpen(lobby);
    this.validation.assertPhase(lobby, [GamePhase.Building]);
    const player = this.validation.assertCurrentPlayer(lobby, sessionToken);
    this.validation.assertCityCost(player);
    const settlement = lobby.settlements.find(
      (candidate) => candidate.vertexId === vertexId && candidate.seat === player.seat,
    );
    if (!settlement || settlement.isCity) {
      throw new Error(ActionRejectCode.IllegalPlacement);
    }
    this.validation.deductCityCost(player);
    settlement.isCity = true;
    player.visibleVictoryPoints += 1;
    recomputeWinner(lobby, player.seat);
    this.broadcastFullState(server, lobby);
  }

  public buyDevCard(lobbyId: string, sessionToken: string, server: Server): void {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      throw new Error(ActionRejectCode.UnknownLobby);
    }
    this.assertLobbyOpen(lobby);
    this.validation.assertPhase(lobby, [GamePhase.Building]);
    const player = this.validation.assertCurrentPlayer(lobby, sessionToken);
    if (lobby.devDeck.length === 0) {
      throw new Error(ActionRejectCode.NoDevCardAvailable);
    }
    this.validation.assertDevCardCost(player);
    this.validation.deductDevCardCost(player);
    const topCard = lobby.devDeck.pop();
    if (!topCard) {
      throw new Error(ActionRejectCode.NoDevCardAvailable);
    }
    player.devCards.push(topCard);
    recomputeWinner(lobby, player.seat);
    this.broadcastFullState(server, lobby);
  }

  public playKnight(
    lobbyId: string,
    sessionToken: string,
    q: number,
    r: number,
    victimSeat: PlayerSeat | undefined,
    server: Server,
  ): void {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      throw new Error(ActionRejectCode.UnknownLobby);
    }
    this.assertLobbyOpen(lobby);
    this.validation.assertPhase(lobby, [GamePhase.Trading, GamePhase.Building]);
    const player = this.validation.assertCurrentPlayer(lobby, sessionToken);
    if (!consumeDevCard(player, DevCardType.Knight)) {
      throw new Error(ActionRejectCode.DevCardNotOwned);
    }
    player.playedKnights += 1;
    recomputeLargestArmy(lobby);
    applyRobberMove(lobby, player, q, r, victimSeat);
    recomputeWinner(lobby, player.seat);
    this.broadcastFullState(server, lobby);
  }

  public playMonopoly(
    lobbyId: string,
    sessionToken: string,
    resource: ResourceType,
    server: Server,
  ): void {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      throw new Error(ActionRejectCode.UnknownLobby);
    }
    this.assertLobbyOpen(lobby);
    this.validation.assertPhase(lobby, [GamePhase.Trading, GamePhase.Building]);
    const player = this.validation.assertCurrentPlayer(lobby, sessionToken);
    if (!consumeDevCard(player, DevCardType.Monopoly)) {
      throw new Error(ActionRejectCode.DevCardNotOwned);
    }
    for (let i = 0; i < lobby.players.length; i += 1) {
      const other = lobby.players[i];
      if (other.seat === player.seat) {
        continue;
      }
      const amount = other.resources[resource] ?? 0;
      if (amount > 0) {
        other.resources[resource] = 0;
        player.resources[resource] = (player.resources[resource] ?? 0) + amount;
      }
    }
    this.broadcastFullState(server, lobby);
  }

  public playYearOfPlenty(
    lobbyId: string,
    sessionToken: string,
    first: ResourceType,
    second: ResourceType,
    server: Server,
  ): void {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      throw new Error(ActionRejectCode.UnknownLobby);
    }
    this.assertLobbyOpen(lobby);
    this.validation.assertPhase(lobby, [GamePhase.Trading, GamePhase.Building]);
    const player = this.validation.assertCurrentPlayer(lobby, sessionToken);
    if (!consumeDevCard(player, DevCardType.YearOfPlenty)) {
      throw new Error(ActionRejectCode.DevCardNotOwned);
    }
    player.resources[first] = (player.resources[first] ?? 0) + 1;
    player.resources[second] = (player.resources[second] ?? 0) + 1;
    this.broadcastFullState(server, lobby);
  }

  public playRoadBuilding(
    lobbyId: string,
    sessionToken: string,
    firstEdgeId: string,
    secondEdgeId: string | undefined,
    server: Server,
  ): void {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      throw new Error(ActionRejectCode.UnknownLobby);
    }
    this.assertLobbyOpen(lobby);
    this.validation.assertPhase(lobby, [GamePhase.Trading, GamePhase.Building]);
    const player = this.validation.assertCurrentPlayer(lobby, sessionToken);
    if (!consumeDevCard(player, DevCardType.RoadBuilding)) {
      throw new Error(ActionRejectCode.DevCardNotOwned);
    }
    this.validation.assertLegalRoadEdge(lobby, player, firstEdgeId);
    lobby.roads.push({ seat: player.seat, edgeId: firstEdgeId });
    if (secondEdgeId !== undefined && secondEdgeId.length > 0) {
      this.validation.assertLegalRoadEdge(lobby, player, secondEdgeId);
      lobby.roads.push({ seat: player.seat, edgeId: secondEdgeId });
    }
    recomputeLongestRoad(lobby);
    recomputeWinner(lobby, player.seat);
    this.broadcastFullState(server, lobby);
  }

  public bankTrade(
    lobbyId: string,
    sessionToken: string,
    giveResource: ResourceType,
    giveAmount: number,
    receiveResource: ResourceType,
    server: Server,
  ): void {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      throw new Error(ActionRejectCode.UnknownLobby);
    }
    this.assertLobbyOpen(lobby);
    this.validation.assertPhase(lobby, [GamePhase.Trading]);
    const player = this.validation.assertCurrentPlayer(lobby, sessionToken);
    const rates = resolveHarborRates(lobby, player.seat);
    const expectedGive = rates[giveResource];
    if (
      giveAmount !== expectedGive ||
      giveAmount <= 0 ||
      receiveResource === giveResource
    ) {
      throw new Error(ActionRejectCode.InvalidBankTrade);
    }
    if ((player.resources[giveResource] ?? 0) < giveAmount) {
      throw new Error(ActionRejectCode.InsufficientResources);
    }
    player.resources[giveResource] = (player.resources[giveResource] ?? 0) - giveAmount;
    player.resources[receiveResource] = (player.resources[receiveResource] ?? 0) + 1;
    this.broadcastFullState(server, lobby);
  }

  public describeError(e: unknown): { code: ActionRejectCode; message: string } {
    if (e instanceof BadRequestException) {
      const response = e.getResponse();
      const message = typeof response === 'string' ? response : JSON.stringify(response);
      return { code: asRejectCode(message), message };
    }
    if (e instanceof Error) {
      return { code: asRejectCode(e.message), message: e.message };
    }
    return {
      code: ActionRejectCode.WrongPhase,
      message: DescribeErrorMessage.UnknownError,
    };
  }

  private firstTurnSeat(lobby: LobbyRuntime): PlayerSeat {
    const activeSeats = this.getActiveTurnSeats(lobby);
    if (activeSeats.length === 0) {
      return PlayerSeat.North;
    }
    return activeSeats[0];
  }

  private getActiveTurnSeats(lobby: LobbyRuntime): PlayerSeat[] {
    const activeSeats: PlayerSeat[] = [];
    for (let i = 0; i < TURN_ORDER.length; i += 1) {
      const seat = TURN_ORDER[i];
      if (lobby.findPlayerBySeat(seat)) {
        activeSeats.push(seat);
      }
    }
    return activeSeats;
  }

  private applySetupForwardTransition(lobby: LobbyRuntime, placedBySeat: PlayerSeat): void {
    lobby.setupPlacementsBySeat[placedBySeat] += 1;
    const activeSeats = this.getActiveTurnSeats(lobby);
    const currentIndex = activeSeats.indexOf(placedBySeat);
    const isLastForwardSeat = currentIndex >= 0 && currentIndex === activeSeats.length - 1;
    if (isLastForwardSeat) {
      lobby.fsm.onSetupForwardCompleted();
      lobby.currentSeat = placedBySeat;
      return;
    }
    if (currentIndex < 0) {
      throw new Error(ActionRejectCode.NotYourTurn);
    }
    lobby.currentSeat = activeSeats[currentIndex + 1];
  }

  private applySetupBackwardTransition(lobby: LobbyRuntime, placedBySeat: PlayerSeat): void {
    lobby.setupPlacementsBySeat[placedBySeat] += 1;
    const activeSeats = this.getActiveTurnSeats(lobby);
    const currentIndex = activeSeats.indexOf(placedBySeat);
    if (currentIndex < 0) {
      throw new Error(ActionRejectCode.NotYourTurn);
    }
    const isBackwardDone = currentIndex === 0;
    if (isBackwardDone) {
      lobby.currentSeat = activeSeats[0];
      lobby.fsm.onSetupCompleted();
      return;
    }
    lobby.currentSeat = activeSeats[currentIndex - 1];
  }

  private grantSetupResourceFromSettlement(
    lobby: LobbyRuntime,
    seat: PlayerSeat,
    vertexId: string,
  ): void {
    const owner = lobby.findPlayerBySeat(seat);
    if (!owner) {
      return;
    }
    const vertex = lobby.verticesById.get(vertexId);
    if (!vertex) {
      return;
    }
    for (let i = 0; i < vertex.adjacentTileKeys.length; i += 1) {
      const tileKey = vertex.adjacentTileKeys[i];
      const tile = this.findTileByKey(lobby, tileKey);
      if (!tile) {
        continue;
      }
      const resource = this.mapTileToResource(tile.type);
      if (!resource) {
        continue;
      }
      owner.resources[resource] = (owner.resources[resource] ?? 0) + 1;
    }
  }

  private createDiceRoll(): DiceRollDto {
    const a = this.randomDie();
    const b = this.randomDie();
    return { a, b, sum: a + b };
  }

  private randomDie(): number {
    return 1 + Math.floor(Math.random() * 6);
  }

  private collectRobberDiscardSeats(lobby: LobbyRuntime): PlayerSeat[] {
    const seats: PlayerSeat[] = [];
    for (let i = 0; i < lobby.players.length; i += 1) {
      const player = lobby.players[i];
      if (lobby.requiredRobberDiscardCount(player) > 0) {
        seats.push(player.seat);
      }
    }
    return seats;
  }

  private applyResourceProduction(lobby: LobbyRuntime, rolledNumber: number): void {
    for (let i = 0; i < lobby.settlements.length; i += 1) {
      const settlement = lobby.settlements[i];
      const vertex = lobby.verticesById.get(settlement.vertexId);
      if (!vertex) {
        continue;
      }
      const owner = lobby.findPlayerBySeat(settlement.seat);
      if (!owner) {
        continue;
      }
      for (let tileIndex = 0; tileIndex < vertex.adjacentTileKeys.length; tileIndex += 1) {
        const tileKey = vertex.adjacentTileKeys[tileIndex];
        const tile = this.findTileByKey(lobby, tileKey);
        if (!tile || tile.number !== rolledNumber) {
          continue;
        }
        if (tile.coord.q === lobby.robberCoord.q && tile.coord.r === lobby.robberCoord.r) {
          continue;
        }
        const resource = this.mapTileToResource(tile.type);
        if (!resource) {
          continue;
        }
        const amount = settlement.isCity ? 2 : 1;
        owner.resources[resource] = (owner.resources[resource] ?? 0) + amount;
      }
    }
  }

  private mapTileToResource(type: TileType): ResourceType | null {
    if (type === TileType.Forest) {
      return ResourceType.Wood;
    }
    if (type === TileType.Hills) {
      return ResourceType.Brick;
    }
    if (type === TileType.Fields) {
      return ResourceType.Wheat;
    }
    if (type === TileType.Pasture) {
      return ResourceType.Wool;
    }
    if (type === TileType.Mountains) {
      return ResourceType.Ore;
    }
    return null;
  }

  private findTileByKey(lobby: LobbyRuntime, tileKey: string) {
    for (let i = 0; i < lobby.tiles.length; i += 1) {
      const tile = lobby.tiles[i];
      if (makeTileKey(tile.coord.q, tile.coord.r) === tileKey) {
        return tile;
      }
    }
    return undefined;
  }

  private nextSeat(lobby: LobbyRuntime, currentSeat: PlayerSeat): PlayerSeat {
    const activeSeats = this.getActiveTurnSeats(lobby);
    const currentIndex = activeSeats.indexOf(currentSeat);
    if (currentIndex < 0) {
      return this.firstTurnSeat(lobby);
    }
    const nextIndex = (currentIndex + 1) % activeSeats.length;
    return activeSeats[nextIndex];
  }

  private assertLobbyOpen(lobby: LobbyRuntime): void {
    if (lobby.winnerSeat !== null) {
      throw new Error(ActionRejectCode.GameFinished);
    }
  }

  private fillDemoLobbyWithBots(lobby: LobbyRuntime): void {
    if (lobby.lobbyId !== KnownLobbyId.DemoClient) {
      return;
    }
    let nextSeat = lobby.nextFreeSeat();
    while (nextSeat !== undefined) {
      const botSessionToken = `demo-bot-${nextSeat}`;
      if (lobby.findPlayerByToken(botSessionToken)) {
        break;
      }
      lobby.addPlayer(botSessionToken, this.getDemoBotDisplayName(nextSeat), null);
      nextSeat = lobby.nextFreeSeat();
    }
  }

  private getDemoBotDisplayName(seat: PlayerSeat): string {
    const namesBySeat: Record<PlayerSeat, string> = {
      [PlayerSeat.North]: 'Bot Nord',
      [PlayerSeat.East]: 'Bot Ost',
      [PlayerSeat.South]: 'Bot Sued',
      [PlayerSeat.West]: 'Bot West',
    };
    return namesBySeat[seat];
  }

  private resolveAdminSeat(lobby: LobbyRuntime): PlayerSeat {
    const adminToken = lobby.adminSessionToken;
    if (adminToken !== null) {
      const adminPlayer = lobby.findPlayerByToken(adminToken);
      if (adminPlayer) {
        return adminPlayer.seat;
      }
    }
    return PlayerSeat.North;
  }
}
