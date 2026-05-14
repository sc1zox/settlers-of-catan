import { randomUUID } from 'node:crypto';
import {
  ActionRejectCode,
  ActionRejectedPayload,
  BuildSettlementPayload,
  GameSocketClientEvent,
  GameSocketServerEvent,
  JoinLobbyPayload,
  LobbyJoinedPayload,
  ResourceType,
  SessionBoundPayload,
  TradeAcceptPayload,
  TradeProposePayload,
  TradeRejectPayload,
  TradeStatus,
  TradeUpdatedPayload,
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
import { GameService, lobbyRoomName } from './game.service';
import type { LobbyPlayerSlot } from './lobby-runtime';
import { SocketConnectionRegistry } from './socket-connection.registry';
import { TradeService } from './trade.service';
import { isUuid } from './uuid.util';

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/game',
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  public server!: Server;

  public constructor(
    private readonly gameService: GameService,
    private readonly registry: SocketConnectionRegistry,
    private readonly tradeService: TradeService,
  ) {}

  public handleConnection(client: Socket): void {
    const raw = client.handshake.auth as Record<string, unknown>;
    let token = typeof raw['sessionToken'] === 'string' ? raw['sessionToken'] : '';
    if (!isUuid(token)) {
      token = randomUUID();
      const payload: SessionBoundPayload = { sessionToken: token };
      client.emit(GameSocketServerEvent.SessionBound, payload);
    }
    this.registry.bind(client.id, token);
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
      const lobbyId = payload.lobbyId.trim() || 'default';
      const displayName = payload.displayName.trim() || 'Player';
      const { lobby, joined } = this.gameService.joinLobby(
        lobbyId,
        sessionToken,
        displayName,
        client.id,
      );
      await client.join(lobbyRoomName(lobby.lobbyId));
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
        payload.q,
        payload.r,
        this.server,
      );
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
      const lobby = this.gameService.getLobby(payload.lobbyId);
      if (!lobby) {
        throw new Error(ActionRejectCode.UnknownLobby);
      }
      const from = lobby.findPlayerByToken(sessionToken);
      if (!from) {
        throw new Error(ActionRejectCode.PlayerNotInLobby);
      }
      const trade = this.tradeService.createOpenOffer(lobby, from, payload);
      const body: TradeUpdatedPayload = { lobbyId: lobby.lobbyId, trade };
      this.server.to(lobbyRoomName(lobby.lobbyId)).emit(GameSocketServerEvent.TradeUpdated, body);
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
      const lobby = this.gameService.getLobby(payload.lobbyId);
      if (!lobby) {
        throw new Error(ActionRejectCode.UnknownLobby);
      }
      const accepter = lobby.findPlayerByToken(sessionToken);
      if (!accepter) {
        throw new Error(ActionRejectCode.PlayerNotInLobby);
      }
      const offer = this.tradeService.getOffer(payload.tradeId);
      if (!offer || offer.status !== TradeStatus.Open) {
        throw new Error(ActionRejectCode.TradeNotOpen);
      }
      if (offer.toSeat !== accepter.seat) {
        throw new Error(ActionRejectCode.NotYourTurn);
      }
      const from = lobby.findPlayerBySeat(offer.fromSeat);
      if (!from) {
        throw new Error(ActionRejectCode.PlayerNotInLobby);
      }
      this.assertCanPayMap(from, offer.offer);
      this.assertCanPayMap(accepter, offer.request);
      this.applyResourceDelta(from, offer.offer, -1);
      this.applyResourceDelta(from, offer.request, 1);
      this.applyResourceDelta(accepter, offer.request, -1);
      this.applyResourceDelta(accepter, offer.offer, 1);
      const updated = this.tradeService.setStatus(offer.id, TradeStatus.Accepted);
      if (updated) {
        const body: TradeUpdatedPayload = { lobbyId: lobby.lobbyId, trade: updated };
        this.server.to(lobbyRoomName(lobby.lobbyId)).emit(GameSocketServerEvent.TradeUpdated, body);
      }
      this.gameService.broadcastFullState(this.server, lobby);
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
      const lobby = this.gameService.getLobby(payload.lobbyId);
      if (!lobby) {
        throw new Error(ActionRejectCode.UnknownLobby);
      }
      const actor = lobby.findPlayerByToken(sessionToken);
      if (!actor) {
        throw new Error(ActionRejectCode.PlayerNotInLobby);
      }
      const offer = this.tradeService.getOffer(payload.tradeId);
      if (!offer || offer.status !== TradeStatus.Open) {
        throw new Error(ActionRejectCode.TradeNotOpen);
      }
      if (offer.fromSeat !== actor.seat && offer.toSeat !== actor.seat) {
        throw new Error(ActionRejectCode.NotYourTurn);
      }
      const updated = this.tradeService.setStatus(offer.id, TradeStatus.Rejected);
      if (updated) {
        const body: TradeUpdatedPayload = { lobbyId: lobby.lobbyId, trade: updated };
        this.server.to(lobbyRoomName(lobby.lobbyId)).emit(GameSocketServerEvent.TradeUpdated, body);
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

  private assertCanPayMap(
    player: LobbyPlayerSlot,
    cost: Readonly<Partial<Record<ResourceType, number>>>,
  ): void {
    const keys = Object.keys(cost) as ResourceType[];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const need = cost[k] ?? 0;
      if ((player.resources[k] ?? 0) < need) {
        throw new Error(ActionRejectCode.InsufficientResources);
      }
    }
  }

  private applyResourceDelta(
    player: LobbyPlayerSlot,
    delta: Readonly<Partial<Record<ResourceType, number>>>,
    sign: 1 | -1,
  ): void {
    const keys = Object.keys(delta) as ResourceType[];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const v = delta[k] ?? 0;
      player.resources[k] = (player.resources[k] ?? 0) + sign * v;
    }
  }
}
