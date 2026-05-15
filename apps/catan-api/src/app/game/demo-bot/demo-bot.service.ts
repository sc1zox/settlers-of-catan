import { Injectable } from '@nestjs/common';
import {
  ActionRejectCode,
  GamePhase,
  KnownLobbyId,
  PlayerSeat,
  ResourceType,
  TileType,
} from '@catan/api-interfaces';
import { collectRobberVictimSeats } from '@catan/shared-game-field';
import { Server } from 'socket.io';
import { GameActionValidationService } from '../validation/game-action-validation.service';
import { CLOCKWISE_SEATS, type LobbyPlayerSlot, LobbyRuntime } from '../lobby/lobby-runtime';

const DEMO_BOT_SESSION_TOKEN_PREFIX = 'demo-bot-';
const DEMO_SETUP_AUTOPLAY_MAX_STEPS = 16;
const DEMO_MAIN_GAME_DRAIN_MAX_STEPS = 150;

export interface DemoSetupBotCallbacks {
  getLobby(lobbyId: string): LobbyRuntime | undefined;
  buildSettlement(lobbyId: string, sessionToken: string, vertexId: string, server: Server): void;
  buildRoad(lobbyId: string, sessionToken: string, edgeId: string, server: Server): void;
}

export interface DemoMainGameCallbacks {
  getLobby(lobbyId: string): LobbyRuntime | undefined;
  rollDice(lobbyId: string, sessionToken: string, server: Server): void;
  finishTrading(lobbyId: string, sessionToken: string, server: Server): void;
  endTurn(lobbyId: string, sessionToken: string, server: Server): void;
  submitRobberDiscard(
    lobbyId: string,
    sessionToken: string,
    discard: Readonly<Partial<Record<ResourceType, number>>>,
    server: Server,
  ): void;
  moveRobber(
    lobbyId: string,
    sessionToken: string,
    q: number,
    r: number,
    victimSeat: PlayerSeat | undefined,
    server: Server,
  ): void;
  buildSettlement(lobbyId: string, sessionToken: string, vertexId: string, server: Server): void;
  buildRoad(lobbyId: string, sessionToken: string, edgeId: string, server: Server): void;
  buildCity(lobbyId: string, sessionToken: string, vertexId: string, server: Server): void;
}

@Injectable()
export class DemoBotService {
  private readonly autoplayLobbyIds = new Set<string>();
  private mainGameDrainActive = false;

  public constructor(private readonly validation: GameActionValidationService) {}

  public afterLobbyBroadcast(
    lobbyId: string,
    server: Server,
    callbacks: DemoMainGameCallbacks,
  ): void {
    const lobby = callbacks.getLobby(lobbyId);
    if (!lobby || !this.isDemoLobby(lobby)) {
      return;
    }
    if (this.mainGameDrainActive) {
      return;
    }
    this.mainGameDrainActive = true;
    try {
      for (let step = 0; step < DEMO_MAIN_GAME_DRAIN_MAX_STEPS; step += 1) {
        if (!this.tryOneDemoMainGameAction(lobbyId, server, callbacks)) {
          return;
        }
      }
    } finally {
      this.mainGameDrainActive = false;
    }
  }

  public pruneDemoLobbyStaleHumans(
    lobby: LobbyRuntime,
    joiningSessionToken: string,
  ): void {
    if (!this.isDemoLobby(lobby) || lobby.fsm.getPhase() !== GamePhase.LobbyWaiting) {
      return;
    }
    let removedAdmin = false;
    for (let i = lobby.players.length - 1; i >= 0; i -= 1) {
      const player = lobby.players[i];
      if (
        this.isDemoBotSessionToken(player.sessionToken) ||
        player.sessionToken === joiningSessionToken ||
        player.socketId !== null
      ) {
        continue;
      }
      lobby.clearDisconnectTimer(player);
      if (lobby.adminSessionToken === player.sessionToken) {
        removedAdmin = true;
      }
      lobby.players.splice(i, 1);
    }
    if (removedAdmin) {
      lobby.adminSessionToken = null;
    }
  }

  public fillDemoLobbyWithBots(lobby: LobbyRuntime): void {
    if (!this.isDemoLobby(lobby)) {
      return;
    }
    let nextSeat = lobby.nextFreeSeat();
    while (nextSeat !== undefined) {
      const botSessionToken = `${DEMO_BOT_SESSION_TOKEN_PREFIX}${nextSeat}`;
      if (lobby.findPlayerByToken(botSessionToken)) {
        break;
      }
      lobby.addPlayer(botSessionToken, this.getDemoBotDisplayName(nextSeat), null, true);
      nextSeat = lobby.nextFreeSeat();
    }
  }

  public getActiveTurnSeats(lobby: LobbyRuntime): PlayerSeat[] {
    const activeSeats: PlayerSeat[] = [];
    for (let i = 0; i < CLOCKWISE_SEATS.length; i += 1) {
      const seat = CLOCKWISE_SEATS[i];
      const player = lobby.findPlayerBySeat(seat);
      if (!player) {
        continue;
      }
      activeSeats.push(seat);
    }
    return activeSeats;
  }

  public getMinimumStartPlayerCount(lobby: LobbyRuntime): number {
    if (this.isDemoLobby(lobby)) {
      return 1;
    }
    return 3;
  }

  public resolveDemoBotTradeAcceptorSessionToken(
    lobby: LobbyRuntime | undefined,
    toSeat: PlayerSeat,
  ): string | null {
    if (lobby === undefined) {
      return null;
    }
    const target = lobby.findPlayerBySeat(toSeat);
    if (!target || !this.isDemoBotSessionToken(target.sessionToken)) {
      return null;
    }
    return target.sessionToken;
  }

  public runDemoSetupAutoplay(
    lobbyId: string,
    server: Server,
    callbacks: DemoSetupBotCallbacks,
  ): void {
    const lobby = callbacks.getLobby(lobbyId);
    if (!lobby || !this.isDemoLobby(lobby)) {
      return;
    }
    if (this.autoplayLobbyIds.has(lobbyId)) {
      return;
    }
    this.autoplayLobbyIds.add(lobbyId);
    try {
      this.runDemoSetupAutoplayStep(lobbyId, server, callbacks, 0);
    } finally {
      this.autoplayLobbyIds.delete(lobbyId);
    }
  }

  private runDemoSetupAutoplayStep(
    lobbyId: string,
    server: Server,
    callbacks: DemoSetupBotCallbacks,
    depth: number,
  ): void {
    if (depth >= DEMO_SETUP_AUTOPLAY_MAX_STEPS) {
      return;
    }
    const nextLobby = callbacks.getLobby(lobbyId);
    if (!nextLobby) {
      return;
    }
    const phase = nextLobby.fsm.getPhase();
    if (!this.isSetupPhase(phase)) {
      return;
    }
    const current = nextLobby.findPlayerBySeat(nextLobby.currentSeat);
    if (!current || !this.isDemoBotSessionToken(current.sessionToken)) {
      return;
    }
    this.runSingleDemoSetupBotTurn(lobbyId, nextLobby, current, server, callbacks);
    this.runDemoSetupAutoplayStep(lobbyId, server, callbacks, depth + 1);
  }

  private runSingleDemoSetupBotTurn(
    lobbyId: string,
    lobby: LobbyRuntime,
    bot: LobbyPlayerSlot,
    server: Server,
    callbacks: DemoSetupBotCallbacks,
  ): void {
    const settlementVertexId = this.pickLegalSetupSettlementVertex(lobby, bot);
    if (settlementVertexId === null) {
      throw new Error(ActionRejectCode.IllegalPlacement);
    }
    callbacks.buildSettlement(lobbyId, bot.sessionToken, settlementVertexId, server);
    const pendingVertexId = lobby.pendingSetupRoadFromVertexId;
    if (pendingVertexId === null) {
      throw new Error(ActionRejectCode.IllegalPlacement);
    }
    const roadEdgeId = this.pickLegalSetupRoadEdge(lobby, bot, pendingVertexId);
    if (roadEdgeId === null) {
      throw new Error(ActionRejectCode.IllegalPlacement);
    }
    callbacks.buildRoad(lobbyId, bot.sessionToken, roadEdgeId, server);
  }

  private tryOneDemoMainGameAction(
    lobbyId: string,
    server: Server,
    callbacks: DemoMainGameCallbacks,
  ): boolean {
    const lobby = callbacks.getLobby(lobbyId);
    if (!lobby || !this.isDemoLobby(lobby)) {
      return false;
    }
    const phase = lobby.fsm.getPhase();
    if (
      phase === GamePhase.LobbyWaiting ||
      phase === GamePhase.SetupForward ||
      phase === GamePhase.SetupBackward ||
      phase === GamePhase.Finished
    ) {
      return false;
    }
    if (phase === GamePhase.RobberDiscard) {
      const bot = this.firstDemoBotNeedingRobberDiscard(lobby);
      if (bot === undefined) {
        return false;
      }
      const discard = this.pickRobberDiscardForPlayer(lobby, bot);
      callbacks.submitRobberDiscard(lobbyId, bot.sessionToken, discard, server);
      return true;
    }
    const current = lobby.findPlayerBySeat(lobby.currentSeat);
    if (!current || !this.isDemoBotSessionToken(current.sessionToken)) {
      return false;
    }
    if (phase === GamePhase.Rolling) {
      callbacks.rollDice(lobbyId, current.sessionToken, server);
      return true;
    }
    if (phase === GamePhase.RobberMove) {
      const pick = this.pickRobberMove(lobby, current);
      if (pick === null) {
        return false;
      }
      callbacks.moveRobber(lobbyId, current.sessionToken, pick.q, pick.r, pick.victimSeat, server);
      return true;
    }
    if (phase === GamePhase.Trading) {
      callbacks.finishTrading(lobbyId, current.sessionToken, server);
      return true;
    }
    if (phase === GamePhase.Building) {
      const moves = this.validation.computeLegalMoves(lobby, current.seat);
      if (moves.cities.length > 0) {
        callbacks.buildCity(lobbyId, current.sessionToken, moves.cities[0], server);
        return true;
      }
      if (moves.settlements.length > 0) {
        callbacks.buildSettlement(lobbyId, current.sessionToken, moves.settlements[0], server);
        return true;
      }
      if (moves.roads.length > 0) {
        callbacks.buildRoad(lobbyId, current.sessionToken, moves.roads[0], server);
        return true;
      }
      callbacks.endTurn(lobbyId, current.sessionToken, server);
      return true;
    }
    return false;
  }

  private firstDemoBotNeedingRobberDiscard(lobby: LobbyRuntime): LobbyPlayerSlot | undefined {
    for (let i = 0; i < CLOCKWISE_SEATS.length; i += 1) {
      const seat = CLOCKWISE_SEATS[i];
      if (!lobby.pendingRobberDiscardSeats.includes(seat)) {
        continue;
      }
      const player = lobby.findPlayerBySeat(seat);
      if (player && this.isDemoBotSessionToken(player.sessionToken)) {
        return player;
      }
    }
    return undefined;
  }

  private pickRobberDiscardForPlayer(
    lobby: LobbyRuntime,
    player: LobbyPlayerSlot,
  ): Readonly<Partial<Record<ResourceType, number>>> {
    const expected = lobby.requiredRobberDiscardCount(player);
    const discard: Partial<Record<ResourceType, number>> = {};
    const keys = Object.values(ResourceType);
    let remaining = expected;
    for (let round = 0; round < 16 && remaining > 0; round += 1) {
      for (let k = 0; k < keys.length && remaining > 0; k += 1) {
        const resource = keys[k];
        const have = player.resources[resource] ?? 0;
        const already = discard[resource] ?? 0;
        if (have > already) {
          discard[resource] = already + 1;
          remaining -= 1;
        }
      }
    }
    return discard;
  }

  private pickRobberMove(
    lobby: LobbyRuntime,
    actor: LobbyPlayerSlot,
  ): { q: number; r: number; victimSeat: PlayerSeat | undefined } | null {
    for (let i = 0; i < lobby.tiles.length; i += 1) {
      const tile = lobby.tiles[i];
      if (tile.type === TileType.Water) {
        continue;
      }
      if (tile.coord.q === lobby.robberCoord.q && tile.coord.r === lobby.robberCoord.r) {
        continue;
      }
      const victimSeat = this.pickRobberVictimSeat(lobby, actor.seat, tile.coord.q, tile.coord.r);
      return { q: tile.coord.q, r: tile.coord.r, victimSeat };
    }
    return null;
  }

  private pickRobberVictimSeat(
    lobby: LobbyRuntime,
    actorSeat: PlayerSeat,
    q: number,
    r: number,
  ): PlayerSeat | undefined {
    const seats = collectRobberVictimSeats(
      lobby.tiles,
      lobby.settlements.map((s) => ({ seat: s.seat, vertexId: s.vertexId })),
      lobby.players.map((p) => ({
        seat: p.seat,
        totalResourceCards: this.countResourceCards(p),
      })),
      actorSeat,
      q,
      r,
    );
    if (seats.length === 0) {
      return undefined;
    }
    return seats[0] as PlayerSeat;
  }

  private countResourceCards(player: LobbyPlayerSlot): number {
    let total = 0;
    const keys = Object.values(ResourceType);
    for (let i = 0; i < keys.length; i += 1) {
      total += player.resources[keys[i]] ?? 0;
    }
    return total;
  }

  private pickLegalSetupSettlementVertex(lobby: LobbyRuntime, bot: LobbyPlayerSlot): string | null {
    const vertexIds = Array.from(lobby.verticesById.keys());
    for (let i = 0; i < vertexIds.length; i += 1) {
      const vertexId = vertexIds[i];
      try {
        this.validation.assertLegalSettlementVertex(lobby, bot, vertexId, false);
        return vertexId;
      } catch (error: unknown) {
        void error;
      }
    }
    return null;
  }

  private pickLegalSetupRoadEdge(
    lobby: LobbyRuntime,
    bot: LobbyPlayerSlot,
    requiredVertexId: string,
  ): string | null {
    const edgeIds = Array.from(lobby.edgesById.keys());
    for (let i = 0; i < edgeIds.length; i += 1) {
      const edgeId = edgeIds[i];
      try {
        this.validation.assertLegalRoadEdge(lobby, bot, edgeId, requiredVertexId);
        return edgeId;
      } catch (error: unknown) {
        void error;
      }
    }
    return null;
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

  private isDemoLobby(lobby: LobbyRuntime): boolean {
    return lobby.lobbyId === KnownLobbyId.DemoClient;
  }

  private isDemoBotSessionToken(sessionToken: string): boolean {
    return sessionToken.startsWith(DEMO_BOT_SESSION_TOKEN_PREFIX);
  }

  private isSetupPhase(phase: GamePhase): boolean {
    return phase === GamePhase.SetupForward || phase === GamePhase.SetupBackward;
  }
}
