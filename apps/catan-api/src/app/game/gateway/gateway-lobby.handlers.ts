import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import {
  CreateLobbyPayload,
  DefaultDisplayName,
  FillLobbyWithBotsPayload,
  formatSocketIoLobbyRoomId,
  GameSocketServerEvent,
  JoinLobbyPayload,
  KickAndReplaceWithBotPayload,
  LeaveLobbyPayload,
  LobbyJoinedPayload,
  StartLobbyPayload,
} from '@catan/api-interfaces';
import { GameService } from '../core/game.service';
import { LobbySocketFacade } from '../match-flow/lobby-socket.facade';
import { TradeReconnectService } from '../trade/trade-reconnect.service';
import { GatewaySocketSessionService } from './gateway-common.services';

@Injectable()
export class GatewayLobbyHandlers {
  public constructor(
    private readonly gameService: GameService,
    private readonly sessions: GatewaySocketSessionService,
    private readonly lobbySocket: LobbySocketFacade,
    private readonly tradeReconnect: TradeReconnectService,
  ) {}

  public async joinLobby(server: Server, client: Socket, payload: JoinLobbyPayload): Promise<void> {
    const sessionToken = this.sessions.requireSessionToken(client);
    const lobbyCode = payload.lobbyCode.trim();
    const displayName = payload.displayName.trim() || DefaultDisplayName.PlayerEn;
    const { lobby, joined } = await this.gameService.joinLobby(
      lobbyCode,
      sessionToken,
      displayName,
      client.id,
    );
    await client.join(formatSocketIoLobbyRoomId(lobby.lobbyId));
    const joinedPayload: LobbyJoinedPayload = joined;
    client.emit(GameSocketServerEvent.LobbyJoined, joinedPayload);
    this.gameService.broadcastFullState(server, lobby);
    this.tradeReconnect.resyncOpenTradesForSocket(server, lobby.lobbyId, client.id, joined.seat);
  }

  public async createLobby(
    server: Server,
    client: Socket,
    payload: CreateLobbyPayload,
  ): Promise<void> {
    const sessionToken = this.sessions.requireSessionToken(client);
    const lobbyCode = payload.lobbyCode.trim();
    const displayName = payload.displayName.trim() || DefaultDisplayName.PlayerEn;
    const { lobby, joined } = await this.gameService.createLobby(
      lobbyCode,
      sessionToken,
      displayName,
      client.id,
    );
    await client.join(formatSocketIoLobbyRoomId(lobby.lobbyId));
    const joinedPayload: LobbyJoinedPayload = joined;
    client.emit(GameSocketServerEvent.LobbyJoined, joinedPayload);
    this.gameService.broadcastFullState(server, lobby);
  }

  public async leaveLobby(
    server: Server,
    client: Socket,
    payload: LeaveLobbyPayload,
  ): Promise<void> {
    const sessionToken = this.sessions.requireSessionToken(client);
    await this.gameService.leaveLobby(payload.lobbyId, sessionToken, server);
  }

  public startLobby(server: Server, client: Socket, payload: StartLobbyPayload): void {
    const sessionToken = this.sessions.requireSessionToken(client);
    this.lobbySocket.startLobby(payload.lobbyId, sessionToken, server);
  }

  public fillLobbyWithBots(
    server: Server,
    client: Socket,
    payload: FillLobbyWithBotsPayload,
  ): void {
    const sessionToken = this.sessions.requireSessionToken(client);
    this.lobbySocket.fillLobbyWithBots(payload.lobbyId, sessionToken, server);
  }

  public kickAndReplaceWithBot(
    server: Server,
    client: Socket,
    payload: KickAndReplaceWithBotPayload,
  ): void {
    const sessionToken = this.sessions.requireSessionToken(client);
    this.gameService.kickAndReplaceWithBot(payload.lobbyId, sessionToken, payload.seat, server);
  }
}
