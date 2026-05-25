import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ActionRejectCode,
  asActionRejectCode,
  DiceRolledPayload,
  GameSocketServerEvent,
  PlayerSeat,
  ResourceType,
  formatSocketIoLobbyRoomId,
  type LobbyFullStatePayload,
  type LobbyJoinedPayload,
} from '@catan/api-interfaces';
import { Server, Socket } from 'socket.io';
import { BuildActionService } from '../build/build-action.service';
import { BotService, BotMainGameCallbacks, BotSetupCallbacks } from '../bot/bot.service';
import { DevCardsService } from '../dev-cards/dev-cards.service';
import { EconomyService } from '../economy/economy.service';
import { LobbyRuntime } from '../lobby/lobby-runtime';
import { LobbyService } from '../lobby/lobby.service';
import { LobbyOrchestratorService } from '../lobby-orchestrator/lobby-orchestrator.service';
import { MatchFlowService } from '../match-flow/match-flow.service';
import { ReconnectService } from '../reconnect/reconnect.service';
import { RobberService } from '../robber/robber.service';

function extractBadRequestMessage(response: string | object): string {
  if (typeof response === 'string') {
    return response;
  }
  const indexed = response as Record<string, unknown>;
  const rawMessage = indexed['message'];
  if (typeof rawMessage === 'string') {
    return rawMessage;
  }
  if (Array.isArray(rawMessage)) {
    const first = rawMessage[0];
    if (typeof first === 'string') {
      return first;
    }
  }
  return JSON.stringify(response);
}

@Injectable()
export class GameService {
  public constructor(
    private readonly lobby: LobbyService,
    private readonly lobbyOrchestrator: LobbyOrchestratorService,
    private readonly reconnect: ReconnectService,
    private readonly matchFlow: MatchFlowService,
    private readonly buildActions: BuildActionService,
    private readonly economy: EconomyService,
    private readonly robber: RobberService,
    private readonly devCards: DevCardsService,
    private readonly demoBots: BotService,
  ) {}

  public getLobby(lobbyId: string): LobbyRuntime | undefined {
    return this.lobby.getLobby(lobbyId);
  }

  public async createLobby(
    lobbyCode: string,
    sessionToken: string,
    displayName: string,
    socketId: string,
  ): Promise<{ lobby: LobbyRuntime; joined: LobbyJoinedPayload }> {
    return this.lobbyOrchestrator.createLobby(lobbyCode, sessionToken, displayName, socketId);
  }

  public async joinLobby(
    lobbyCode: string,
    sessionToken: string,
    displayName: string,
    socketId: string,
  ): Promise<{ lobby: LobbyRuntime; joined: LobbyJoinedPayload }> {
    return this.lobbyOrchestrator.joinLobby(lobbyCode, sessionToken, displayName, socketId);
  }

  public toFullState(lobby: LobbyRuntime, viewerSessionToken: string): LobbyFullStatePayload {
    return this.lobby.toFullState(lobby, viewerSessionToken);
  }

  public broadcastFullState(server: Server, lobby: LobbyRuntime): void {
    this.lobby.broadcastFullState(server, lobby);
    this.lobbyOrchestrator.maybeScheduleSummaryEntry(lobby, server);
    this.demoBots.afterLobbyBroadcast(lobby.lobbyId, server, this.buildMainGameCallbacks());
    this.demoBots.runSetupAutoplay(lobby.lobbyId, server, this.buildSetupAutoplayPort());
  }

  public async resumeSessionSocket(
    sessionToken: string,
    client: Socket,
    server: Server,
  ): Promise<void> {
    await this.reconnect.resumeSessionSocket(sessionToken, client, server);
  }

  public onDisconnect(sessionToken: string, server: Server): void {
    this.reconnect.onDisconnect(sessionToken, server);
  }

  public async leaveLobby(lobbyId: string, sessionToken: string, server: Server): Promise<void> {
    await this.lobbyOrchestrator.leaveLobby(lobbyId, sessionToken, server);
  }

  public kickAndReplaceWithBot(
    lobbyId: string,
    sessionToken: string,
    seat: PlayerSeat,
    server: Server,
  ): void {
    const lobby = this.reconnect.kickAndReplaceWithBot(lobbyId, sessionToken, seat);
    this.broadcastFullState(server, lobby);
  }

  public buildSettlement(
    lobbyId: string,
    sessionToken: string,
    vertexId: string,
    server: Server,
  ): void {
    const lobby = this.lobby.requireLobby(lobbyId);
    this.lobby.assertLobbyOpen(lobby);
    this.buildActions.buildSettlement(lobby, sessionToken, vertexId);
    this.broadcastFullState(server, lobby);
  }

  public buildRoad(lobbyId: string, sessionToken: string, edgeId: string, server: Server): void {
    const lobby = this.lobby.requireLobby(lobbyId);
    this.lobby.assertLobbyOpen(lobby);
    this.buildActions.buildRoad(lobby, sessionToken, edgeId);
    this.broadcastFullState(server, lobby);
  }

  public startLobby(lobbyId: string, sessionToken: string, server: Server): void {
    const lobby = this.lobby.requireLobby(lobbyId);
    this.lobby.assertLobbyOpen(lobby);
    this.lobby.ensureLobbyAdminConsistent(lobby);
    this.matchFlow.startLobby(lobby, sessionToken);
    this.broadcastFullState(server, lobby);
  }

  public fillLobbyWithBots(lobbyId: string, sessionToken: string, server: Server): void {
    const lobby = this.lobbyOrchestrator.fillLobbyWithBots(lobbyId, sessionToken);
    this.broadcastFullState(server, lobby);
  }

  public rollDice(lobbyId: string, sessionToken: string, server: Server): DiceRolledPayload {
    const lobby = this.lobby.requireLobby(lobbyId);
    this.lobby.assertLobbyOpen(lobby);
    const payload = this.matchFlow.rollDice(lobby, sessionToken, lobbyId);
    server.to(formatSocketIoLobbyRoomId(lobbyId)).emit(GameSocketServerEvent.DiceRolled, payload);
    this.economy.resolveDiceRoll(lobby, payload.roll);
    this.broadcastFullState(server, lobby);
    return payload;
  }

  public submitRobberDiscard(
    lobbyId: string,
    sessionToken: string,
    discard: Readonly<Partial<Record<ResourceType, number>>>,
    server: Server,
  ): void {
    const lobby = this.lobby.requireLobby(lobbyId);
    this.lobby.assertLobbyOpen(lobby);
    this.robber.submitRobberDiscard(lobby, sessionToken, discard);
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
    const lobby = this.lobby.requireLobby(lobbyId);
    this.lobby.assertLobbyOpen(lobby);
    this.robber.moveRobber(lobby, sessionToken, q, r, victimSeat);
    this.broadcastFullState(server, lobby);
  }

  public finishTrading(lobbyId: string, sessionToken: string, server: Server): void {
    const lobby = this.lobby.requireLobby(lobbyId);
    this.lobby.assertLobbyOpen(lobby);
    this.matchFlow.completeTradingPhaseAndExpireOffers(lobby, sessionToken, lobbyId, server);
    this.broadcastFullState(server, lobby);
  }

  public endTurn(lobbyId: string, sessionToken: string, server: Server): void {
    const lobby = this.lobby.requireLobby(lobbyId);
    this.lobby.assertLobbyOpen(lobby);
    this.matchFlow.endTurn(lobby, sessionToken);
    this.broadcastFullState(server, lobby);
  }

  public buildCity(lobbyId: string, sessionToken: string, vertexId: string, server: Server): void {
    const lobby = this.lobby.requireLobby(lobbyId);
    this.lobby.assertLobbyOpen(lobby);
    this.buildActions.buildCity(lobby, sessionToken, vertexId);
    this.broadcastFullState(server, lobby);
  }

  public buyDevCard(lobbyId: string, sessionToken: string, server: Server): void {
    const lobby = this.lobby.requireLobby(lobbyId);
    this.lobby.assertLobbyOpen(lobby);
    this.devCards.buyDevCardAsCurrentTurn(lobby, sessionToken);
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
    const lobby = this.lobby.requireLobby(lobbyId);
    this.lobby.assertLobbyOpen(lobby);
    this.devCards.playKnightAsCurrentTurn(lobby, sessionToken, q, r, victimSeat);
    this.broadcastFullState(server, lobby);
  }

  public playMonopoly(
    lobbyId: string,
    sessionToken: string,
    resource: ResourceType,
    server: Server,
  ): void {
    const lobby = this.lobby.requireLobby(lobbyId);
    this.lobby.assertLobbyOpen(lobby);
    this.devCards.playMonopolyAsCurrentTurn(lobby, sessionToken, resource);
    this.broadcastFullState(server, lobby);
  }

  public playYearOfPlenty(
    lobbyId: string,
    sessionToken: string,
    first: ResourceType,
    second: ResourceType,
    server: Server,
  ): void {
    const lobby = this.lobby.requireLobby(lobbyId);
    this.lobby.assertLobbyOpen(lobby);
    this.devCards.playYearOfPlentyAsCurrentTurn(lobby, sessionToken, first, second);
    this.broadcastFullState(server, lobby);
  }

  public playRoadBuilding(
    lobbyId: string,
    sessionToken: string,
    firstEdgeId: string,
    secondEdgeId: string | undefined,
    server: Server,
  ): void {
    const lobby = this.lobby.requireLobby(lobbyId);
    this.lobby.assertLobbyOpen(lobby);
    this.devCards.playRoadBuildingAsCurrentTurn(lobby, sessionToken, firstEdgeId, secondEdgeId);
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
    const lobby = this.lobby.requireLobby(lobbyId);
    this.lobby.assertLobbyOpen(lobby);
    this.economy.bankTradeAsCurrentTurn(
      lobby,
      sessionToken,
      giveResource,
      giveAmount,
      receiveResource,
    );
    this.broadcastFullState(server, lobby);
  }

  private buildSetupAutoplayPort(): BotSetupCallbacks {
    return {
      getLobby: (id: string) => this.lobby.getLobby(id),
      buildSettlement: (id, token, vertexId, srv) => this.buildSettlement(id, token, vertexId, srv),
      buildRoad: (id, token, edgeId, srv) => this.buildRoad(id, token, edgeId, srv),
    };
  }

  private buildMainGameCallbacks(): BotMainGameCallbacks {
    return {
      getLobby: (id: string) => this.lobby.getLobby(id),
      rollDice: (id, token, srv) => this.rollDice(id, token, srv),
      completeTradingPhaseAndExpireOffers: (id, token, srv) => this.finishTrading(id, token, srv),
      endTurn: (id, token, srv) => this.endTurn(id, token, srv),
      submitRobberDiscard: (id, token, discard, srv) => this.submitRobberDiscard(id, token, discard, srv),
      moveRobber: (id, token, q, r, victimSeat, srv) => this.moveRobber(id, token, q, r, victimSeat, srv),
      buildSettlement: (id, token, vertexId, srv) => this.buildSettlement(id, token, vertexId, srv),
      buildRoad: (id, token, edgeId, srv) => this.buildRoad(id, token, edgeId, srv),
      buildCity: (id, token, vertexId, srv) => this.buildCity(id, token, vertexId, srv),
      buyDevCard: (id, token, srv) => this.buyDevCard(id, token, srv),
    };
  }

  public describeError(e: unknown): { code: ActionRejectCode; message: string } {
    let code = ActionRejectCode.Unknown;
    if (e instanceof BadRequestException) {
      code = asActionRejectCode(extractBadRequestMessage(e.getResponse()));
    } else if (e instanceof Error) {
      code = asActionRejectCode(e.message);
    }
    return { code, message: code };
  }
}
