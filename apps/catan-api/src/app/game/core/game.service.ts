import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ActionRejectCode,
  DescribeErrorMessage,
  DiceRolledPayload,
  GameSocketServerEvent,
  PlayerSeat,
  ResourceType,
  formatSocketIoLobbyRoomId,
  type GameDeltaPayload,
  type LobbyFullStatePayload,
  type LobbyJoinedPayload,
} from '@catan/api-interfaces';
import { Server } from 'socket.io';
import { BuildActionService } from '../build/build-action.service';
import { DemoBotService } from '../demo-bot/demo-bot.service';
import { DevCardsService } from '../dev-cards/dev-cards.service';
import { EconomyService } from '../economy/economy.service';
import { LobbyRuntime } from '../lobby/lobby-runtime';
import { LobbyService } from '../lobby/lobby.service';
import { LobbyOrchestratorService } from '../lobby-orchestrator/lobby-orchestrator.service';
import { MatchFlowService } from '../match-flow/match-flow.service';
import { RobberService } from '../robber/robber.service';

function asRejectCode(message: string): ActionRejectCode {
  const values = Object.values(ActionRejectCode) as string[];
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] === message) {
      return message as ActionRejectCode;
    }
  }
  return ActionRejectCode.WrongPhase;
}

@Injectable()
export class GameService {
  public constructor(
    private readonly lobby: LobbyService,
    private readonly lobbyOrchestrator: LobbyOrchestratorService,
    private readonly matchFlow: MatchFlowService,
    private readonly buildActions: BuildActionService,
    private readonly economy: EconomyService,
    private readonly robber: RobberService,
    private readonly devCards: DevCardsService,
    private readonly demoBots: DemoBotService,
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
    const lobbyId = lobby.lobbyId;
    this.demoBots.afterLobbyBroadcast(lobbyId, server, {
      getLobby: (id: string) => this.lobby.getLobby(id),
      rollDice: (id, sessionToken, srv) => {
        this.rollDice(id, sessionToken, srv);
      },
      completeTradingPhaseAndExpireOffers: (id, sessionToken, srv) => {
        this.finishTrading(id, sessionToken, srv);
      },
      endTurn: (id, sessionToken, srv) => {
        this.endTurn(id, sessionToken, srv);
      },
      submitRobberDiscard: (id, sessionToken, discard, srv) => {
        this.submitRobberDiscard(id, sessionToken, discard, srv);
      },
      moveRobber: (id, sessionToken, q, r, victimSeat, srv) => {
        this.moveRobber(id, sessionToken, q, r, victimSeat, srv);
      },
      buildSettlement: (id, sessionToken, vertexId, srv) => {
        this.buildSettlement(id, sessionToken, vertexId, srv);
      },
      buildRoad: (id, sessionToken, edgeId, srv) => {
        this.buildRoad(id, sessionToken, edgeId, srv);
      },
      buildCity: (id, sessionToken, vertexId, srv) => {
        this.buildCity(id, sessionToken, vertexId, srv);
      },
    });
  }

  public onDisconnect(sessionToken: string, server: Server): void {
    this.lobbyOrchestrator.onDisconnect(sessionToken, server);
  }

  public async leaveLobby(lobbyId: string, sessionToken: string, server: Server): Promise<void> {
    await this.lobbyOrchestrator.leaveLobby(lobbyId, sessionToken, server);
  }

  public buildSettlement(
    lobbyId: string,
    sessionToken: string,
    vertexId: string,
    server: Server,
  ): GameDeltaPayload {
    const lobby = this.lobby.requireLobby(lobbyId);
    this.lobby.assertLobbyOpen(lobby);
    const delta = this.buildActions.buildSettlement(lobby, sessionToken, vertexId);
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
    const lobby = this.lobby.requireLobby(lobbyId);
    this.lobby.assertLobbyOpen(lobby);
    const delta = this.buildActions.buildRoad(lobby, sessionToken, edgeId);
    server.to(formatSocketIoLobbyRoomId(lobbyId)).emit(GameSocketServerEvent.GameDelta, delta);
    this.broadcastFullState(server, lobby);
    this.demoBots.runDemoSetupAutoplay(lobbyId, server, {
      getLobby: (requestedLobbyId: string) => this.lobby.getLobby(requestedLobbyId),
      buildSettlement: (
        requestedLobbyId: string,
        botSessionToken: string,
        vId: string,
        requestedServer: Server,
      ) => {
        this.buildSettlement(requestedLobbyId, botSessionToken, vId, requestedServer);
      },
      buildRoad: (
        requestedLobbyId: string,
        botSessionToken: string,
        eId: string,
        requestedServer: Server,
      ) => {
        this.buildRoad(requestedLobbyId, botSessionToken, eId, requestedServer);
      },
    });
    return delta;
  }

  public startLobby(lobbyId: string, sessionToken: string, server: Server): void {
    const lobby = this.lobby.requireLobby(lobbyId);
    this.lobby.assertLobbyOpen(lobby);
    this.lobby.ensureLobbyAdminConsistent(lobby);
    this.matchFlow.startLobby(lobby, sessionToken);
    this.broadcastFullState(server, lobby);
    this.demoBots.runDemoSetupAutoplay(lobbyId, server, {
      getLobby: (requestedLobbyId: string) => this.lobby.getLobby(requestedLobbyId),
      buildSettlement: (
        requestedLobbyId: string,
        botSessionToken: string,
        vertexId: string,
        requestedServer: Server,
      ) => {
        this.buildSettlement(requestedLobbyId, botSessionToken, vertexId, requestedServer);
      },
      buildRoad: (
        requestedLobbyId: string,
        botSessionToken: string,
        edgeId: string,
        requestedServer: Server,
      ) => {
        this.buildRoad(requestedLobbyId, botSessionToken, edgeId, requestedServer);
      },
    });
  }

  public fillLobbyWithBots(lobbyId: string, sessionToken: string, server: Server): void {
    this.lobbyOrchestrator.fillLobbyWithBots(lobbyId, sessionToken, server);
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
}
