import {
  ActionRejectCode,
  ActionRejectedPayload,
  BankTradePayload,
  BuildCityPayload,
  BuildRoadPayload,
  BuildSettlementPayload,
  BuyDevCardPayload,
  EndTurnPayload,
  PlayKnightPayload,
  PlayMonopolyPayload,
  PlayRoadBuildingPayload,
  PlayYearOfPlentyPayload,
  DefaultDisplayName,
  FinishTradingPayload,
  formatSocketIoLobbyRoomId,
  GameSocketClientEvent,
  GameSocketServerEvent,
  MoveRobberPayload,
  HttpHeaderNameLowercase,
  JoinLobbyPayload,
  KnownLobbyId,
  LobbyJoinedPayload,
  RobberDiscardPayload,
  RollDicePayload,
  SocketAuthPayloadKey,
  SocketGatewayNamespace,
  StartLobbyPayload,
  TradeAcceptPayload,
  TradeProposePayload,
  TradeRejectPayload,
  parseAuthorizationBearerFromUnknown,
} from '@catan/api-interfaces';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from '../core/game.service';
import type { LobbyRuntime } from '../lobby/lobby-runtime';
import { SocketConnectionRegistry } from './socket-connection.registry';
import { TradeActionsService } from '../trade/trade-actions.service';
import { PlayerSessionJwtService } from '../../session/player-session-jwt.service';
import { isUuid } from '../utils/uuid.util';
import { resolveSocketIoCors } from '../../http/cors-env.util';

const GAME_SOCKET_CORS = resolveSocketIoCors();

@WebSocketGateway({
  cors: GAME_SOCKET_CORS,
  namespace: SocketGatewayNamespace.Game,
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  public server!: Server;

  public constructor(
    private readonly gameService: GameService,
    private readonly registry: SocketConnectionRegistry,
    private readonly tradeActions: TradeActionsService,
    private readonly playerJwt: PlayerSessionJwtService,
  ) {}

  public async handleConnection(client: Socket): Promise<void> {
    let sessionId: string | undefined;
    const raw = client.handshake.auth as Record<string, unknown>;
    const accessKey = SocketAuthPayloadKey.AccessToken;
    const jwtFromAuth = typeof raw[accessKey] === 'string' ? raw[accessKey] : '';
    const headerRaw = client.handshake.headers[HttpHeaderNameLowercase.Authorization];
    const headerValue = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
    const jwtFromBearer = parseAuthorizationBearerFromUnknown(headerValue) ?? '';
    const jwtCandidate =
      jwtFromAuth.length > 0 ? jwtFromAuth : jwtFromBearer;
    if (jwtCandidate.length > 0) {
      try {
        sessionId = this.playerJwt.verifyAccessToken(jwtCandidate);
      } catch {
        sessionId = undefined;
      }
    }
    if (sessionId === undefined) {
      const legacyKey = SocketAuthPayloadKey.SessionToken;
      const legacy = raw[legacyKey];
      if (typeof legacy === 'string' && isUuid(legacy)) {
        sessionId = legacy;
      }
    }
    if (sessionId === undefined) {
      client.disconnect(true);
      return;
    }
    this.registry.bind(client.id, sessionId);
  }

  public handleDisconnect(client: Socket): void {
    const token = this.registry.unbindSocket(client.id);
    if (token) {
      this.gameService.onDisconnect(token, this.server);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.JoinLobby)
  public async handleJoinLobby(
    @MessageBody() payload: JoinLobbyPayload,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      const sessionToken = this.registry.getSessionToken(client.id);
      if (!sessionToken) {
        return;
      }
      const lobbyId = payload.lobbyId.trim() || KnownLobbyId.ServerDefault;
      const displayName =
        payload.displayName.trim() || DefaultDisplayName.PlayerEn;
      const { lobby, joined } = this.gameService.joinLobby(
        lobbyId,
        sessionToken,
        displayName,
        client.id,
      );
      await client.join(formatSocketIoLobbyRoomId(lobby.lobbyId));
      const joinedPayload: LobbyJoinedPayload = joined;
      client.emit(GameSocketServerEvent.LobbyJoined, joinedPayload);
      this.gameService.broadcastFullState(this.server, lobby);
    } catch (e) {
      this.emitRejected(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.BuildSettlement)
  public handleBuildSettlement(
    @MessageBody() payload: BuildSettlementPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      const sessionToken = this.registry.getSessionToken(client.id);
      if (!sessionToken) {
        throw new Error(ActionRejectCode.PlayerNotInLobby);
      }
      this.gameService.buildSettlement(
        payload.lobbyId,
        sessionToken,
        payload.vertexId,
        this.server,
      );
    } catch (e) {
      this.emitRejected(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.StartLobby)
  public handleStartLobby(
    @MessageBody() payload: StartLobbyPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      const sessionToken = this.registry.getSessionToken(client.id);
      if (!sessionToken) {
        throw new Error(ActionRejectCode.PlayerNotInLobby);
      }
      this.gameService.startLobby(payload.lobbyId, sessionToken, this.server);
    } catch (e) {
      this.emitRejected(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.BuildRoad)
  public handleBuildRoad(
    @MessageBody() payload: BuildRoadPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      const sessionToken = this.registry.getSessionToken(client.id);
      if (!sessionToken) {
        throw new Error(ActionRejectCode.PlayerNotInLobby);
      }
      this.gameService.buildRoad(payload.lobbyId, sessionToken, payload.edgeId, this.server);
    } catch (e) {
      this.emitRejected(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.BuildCity)
  public handleBuildCity(
    @MessageBody() payload: BuildCityPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      const sessionToken = this.registry.getSessionToken(client.id);
      if (!sessionToken) {
        throw new Error(ActionRejectCode.PlayerNotInLobby);
      }
      this.gameService.buildCity(payload.lobbyId, sessionToken, payload.vertexId, this.server);
    } catch (e) {
      this.emitRejected(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.BuyDevCard)
  public handleBuyDevCard(
    @MessageBody() payload: BuyDevCardPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      const sessionToken = this.registry.getSessionToken(client.id);
      if (!sessionToken) {
        throw new Error(ActionRejectCode.PlayerNotInLobby);
      }
      this.gameService.buyDevCard(payload.lobbyId, sessionToken, this.server);
    } catch (e) {
      this.emitRejected(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.PlayKnight)
  public handlePlayKnight(
    @MessageBody() payload: PlayKnightPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      const sessionToken = this.registry.getSessionToken(client.id);
      if (!sessionToken) {
        throw new Error(ActionRejectCode.PlayerNotInLobby);
      }
      this.gameService.playKnight(
        payload.lobbyId,
        sessionToken,
        payload.q,
        payload.r,
        payload.victimSeat,
        this.server,
      );
    } catch (e) {
      this.emitRejected(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.PlayMonopoly)
  public handlePlayMonopoly(
    @MessageBody() payload: PlayMonopolyPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      const sessionToken = this.registry.getSessionToken(client.id);
      if (!sessionToken) {
        throw new Error(ActionRejectCode.PlayerNotInLobby);
      }
      this.gameService.playMonopoly(payload.lobbyId, sessionToken, payload.resource, this.server);
    } catch (e) {
      this.emitRejected(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.PlayYearOfPlenty)
  public handlePlayYearOfPlenty(
    @MessageBody() payload: PlayYearOfPlentyPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      const sessionToken = this.registry.getSessionToken(client.id);
      if (!sessionToken) {
        throw new Error(ActionRejectCode.PlayerNotInLobby);
      }
      this.gameService.playYearOfPlenty(
        payload.lobbyId,
        sessionToken,
        payload.first,
        payload.second,
        this.server,
      );
    } catch (e) {
      this.emitRejected(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.PlayRoadBuilding)
  public handlePlayRoadBuilding(
    @MessageBody() payload: PlayRoadBuildingPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      const sessionToken = this.registry.getSessionToken(client.id);
      if (!sessionToken) {
        throw new Error(ActionRejectCode.PlayerNotInLobby);
      }
      this.gameService.playRoadBuilding(
        payload.lobbyId,
        sessionToken,
        payload.firstEdgeId,
        payload.secondEdgeId,
        this.server,
      );
    } catch (e) {
      this.emitRejected(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.BankTrade)
  public handleBankTrade(
    @MessageBody() payload: BankTradePayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      const sessionToken = this.registry.getSessionToken(client.id);
      if (!sessionToken) {
        throw new Error(ActionRejectCode.PlayerNotInLobby);
      }
      this.gameService.bankTrade(
        payload.lobbyId,
        sessionToken,
        payload.giveResource,
        payload.giveAmount,
        payload.receiveResource,
        this.server,
      );
    } catch (e) {
      this.emitRejected(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.RollDice)
  public handleRollDice(
    @MessageBody() payload: RollDicePayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      const sessionToken = this.registry.getSessionToken(client.id);
      if (!sessionToken) {
        throw new Error(ActionRejectCode.PlayerNotInLobby);
      }
      this.gameService.rollDice(payload.lobbyId, sessionToken, this.server);
    } catch (e) {
      this.emitRejected(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.RobberDiscard)
  public handleRobberDiscard(
    @MessageBody() payload: RobberDiscardPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      const sessionToken = this.registry.getSessionToken(client.id);
      if (!sessionToken) {
        throw new Error(ActionRejectCode.PlayerNotInLobby);
      }
      this.gameService.submitRobberDiscard(
        payload.lobbyId,
        sessionToken,
        payload.discard,
        this.server,
      );
    } catch (e) {
      this.emitRejected(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.MoveRobber)
  public handleMoveRobber(
    @MessageBody() payload: MoveRobberPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      const sessionToken = this.registry.getSessionToken(client.id);
      if (!sessionToken) {
        throw new Error(ActionRejectCode.PlayerNotInLobby);
      }
      this.gameService.moveRobber(
        payload.lobbyId,
        sessionToken,
        payload.q,
        payload.r,
        payload.victimSeat,
        this.server,
      );
    } catch (e) {
      this.emitRejected(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.FinishTrading)
  public handleFinishTrading(
    @MessageBody() payload: FinishTradingPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      const sessionToken = this.registry.getSessionToken(client.id);
      if (!sessionToken) {
        throw new Error(ActionRejectCode.PlayerNotInLobby);
      }
      this.gameService.finishTrading(payload.lobbyId, sessionToken, this.server);
    } catch (e) {
      this.emitRejected(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.EndTurn)
  public handleEndTurn(
    @MessageBody() payload: EndTurnPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      const sessionToken = this.registry.getSessionToken(client.id);
      if (!sessionToken) {
        throw new Error(ActionRejectCode.PlayerNotInLobby);
      }
      this.gameService.endTurn(payload.lobbyId, sessionToken, this.server);
    } catch (e) {
      this.emitRejected(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.TradePropose)
  public handleTradePropose(
    @MessageBody() payload: TradeProposePayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      const sessionToken = this.registry.getSessionToken(client.id);
      if (!sessionToken) {
        throw new Error(ActionRejectCode.PlayerNotInLobby);
      }
      const body = this.tradeActions.proposeTrade(this.tradeActionContext(), sessionToken, payload);
      this.server
        .to(formatSocketIoLobbyRoomId(body.lobbyId))
        .emit(GameSocketServerEvent.TradeUpdated, body);
    } catch (e) {
      this.emitRejected(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.TradeAccept)
  public handleTradeAccept(
    @MessageBody() payload: TradeAcceptPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      const sessionToken = this.registry.getSessionToken(client.id);
      if (!sessionToken) {
        throw new Error(ActionRejectCode.PlayerNotInLobby);
      }
      const result = this.tradeActions.acceptTrade(this.tradeActionContext(), sessionToken, payload);
      if (result.tradeUpdated !== null) {
        this.server
          .to(formatSocketIoLobbyRoomId(result.lobbyId))
          .emit(GameSocketServerEvent.TradeUpdated, result.tradeUpdated);
      }
    } catch (e) {
      this.emitRejected(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.TradeReject)
  public handleTradeReject(
    @MessageBody() payload: TradeRejectPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      const sessionToken = this.registry.getSessionToken(client.id);
      if (!sessionToken) {
        throw new Error(ActionRejectCode.PlayerNotInLobby);
      }
      const result = this.tradeActions.rejectTrade(this.tradeActionContext(), sessionToken, payload);
      if (result.tradeUpdated !== null) {
        this.server
          .to(formatSocketIoLobbyRoomId(result.lobbyId))
          .emit(GameSocketServerEvent.TradeUpdated, result.tradeUpdated);
      }
    } catch (e) {
      this.emitRejected(client, e);
    }
  }

  private emitRejected(client: Socket, e: unknown): void {
    const { code, message } = this.gameService.describeError(e);
    const payload: ActionRejectedPayload = { code, message };
    client.emit(GameSocketServerEvent.ActionRejected, payload);
  }

  private tradeActionContext(): {
    getLobby: (lobbyId: string) => LobbyRuntime | undefined;
    broadcastLobby: (lobby: LobbyRuntime) => void;
  } {
    return {
      getLobby: (lobbyId: string) => this.gameService.getLobby(lobbyId),
      broadcastLobby: (lobby: LobbyRuntime) => this.gameService.broadcastFullState(this.server, lobby),
    };
  }
}
