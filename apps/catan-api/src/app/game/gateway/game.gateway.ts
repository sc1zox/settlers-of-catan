import { GameSocketClientEvent, SocketGatewayNamespace } from '@catan/api-interfaces';
import { UseFilters, UsePipes } from '@nestjs/common';
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
import { SocketConnectionRegistry } from './socket-connection.registry';
import { resolveSocketIoCors } from '../../http/cors-env.util';
import { GatewaySocketSessionService } from './gateway-common.services';
import { GatewayAuthService } from './gateway-auth.service';
import { GatewayGameplayHandlers } from './gateway-gameplay.handlers';
import { GatewayLobbyHandlers } from './gateway-lobby.handlers';
import { GatewayTradeHandlers } from './gateway-trade.handlers';
import {
  BankTradeWsDto,
  BuildCityWsDto,
  BuildRoadWsDto,
  BuildSettlementWsDto,
  CreateLobbyWsDto,
  JoinLobbyWsDto,
  KickAndReplaceWithBotWsDto,
  LobbyIdWsDto,
  MoveRobberWsDto,
  PlayKnightWsDto,
  PlayMonopolyWsDto,
  PlayRoadBuildingWsDto,
  PlayYearOfPlentyWsDto,
  RobberDiscardWsDto,
  TradeCounterWsDto,
  TradeFinalizeWsDto,
  TradeIdWsDto,
  TradeProposeWsDto,
} from './dto/game-ws-payload.dto';
import { GameGatewayExceptionFilter } from './game-gateway-exception.filter';
import { GAME_WS_VALIDATION_PIPE } from './game-ws-validation.pipe';

const GAME_SOCKET_CORS = resolveSocketIoCors();

@WebSocketGateway({
  cors: GAME_SOCKET_CORS,
  namespace: SocketGatewayNamespace.Game,
})
@UseFilters(GameGatewayExceptionFilter)
@UsePipes(GAME_WS_VALIDATION_PIPE)
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  public server!: Server;

  public constructor(
    private readonly gameService: GameService,
    private readonly registry: SocketConnectionRegistry,
    private readonly gatewayAuth: GatewayAuthService,
    private readonly lobbyHandlers: GatewayLobbyHandlers,
    private readonly gameplayHandlers: GatewayGameplayHandlers,
    private readonly tradeHandlers: GatewayTradeHandlers,
  ) {}

  public async handleConnection(client: Socket): Promise<void> {
    if (!this.gatewayAuth.bindHandshakeSession(client, this.registry, this.server)) {
      client.disconnect(true);
      return;
    }
    const sessionToken = this.registry.getSessionToken(client.id);
    if (sessionToken !== undefined) {
      await this.gameService.resumeSessionSocket(sessionToken, client, this.server);
    }
  }

  public handleDisconnect(client: Socket): void {
    this.gatewayAuth.clearAccessTokenExpiryDisconnect(client);
    const token = this.registry.unbindSocket(client.id);
    if (token) {
      this.gameService.onDisconnect(token, this.server);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.JoinLobby)
  public async handleJoinLobby(
    @MessageBody() payload: JoinLobbyWsDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    await this.lobbyHandlers.joinLobby(this.server, client, payload);
  }

  @SubscribeMessage(GameSocketClientEvent.CreateLobby)
  public async handleCreateLobby(
    @MessageBody() payload: CreateLobbyWsDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    await this.lobbyHandlers.createLobby(this.server, client, payload);
  }

  @SubscribeMessage(GameSocketClientEvent.BuildSettlement)
  public handleBuildSettlement(
    @MessageBody() payload: BuildSettlementWsDto,
    @ConnectedSocket() client: Socket,
  ): void {
    this.gameplayHandlers.buildSettlement(this.server, client, payload);
  }

  @SubscribeMessage(GameSocketClientEvent.LeaveLobby)
  public async handleLeaveLobby(
    @MessageBody() payload: LobbyIdWsDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    await this.lobbyHandlers.leaveLobby(this.server, client, payload);
  }

  @SubscribeMessage(GameSocketClientEvent.StartLobby)
  public handleStartLobby(
    @MessageBody() payload: LobbyIdWsDto,
    @ConnectedSocket() client: Socket,
  ): void {
    this.lobbyHandlers.startLobby(this.server, client, payload);
  }

  @SubscribeMessage(GameSocketClientEvent.FillLobbyWithBots)
  public handleFillLobbyWithBots(
    @MessageBody() payload: LobbyIdWsDto,
    @ConnectedSocket() client: Socket,
  ): void {
    this.lobbyHandlers.fillLobbyWithBots(this.server, client, payload);
  }

  @SubscribeMessage(GameSocketClientEvent.KickAndReplaceWithBot)
  public handleKickAndReplaceWithBot(
    @MessageBody() payload: KickAndReplaceWithBotWsDto,
    @ConnectedSocket() client: Socket,
  ): void {
    this.lobbyHandlers.kickAndReplaceWithBot(this.server, client, payload);
  }

  @SubscribeMessage(GameSocketClientEvent.BuildRoad)
  public handleBuildRoad(
    @MessageBody() payload: BuildRoadWsDto,
    @ConnectedSocket() client: Socket,
  ): void {
    this.gameplayHandlers.buildRoad(this.server, client, payload);
  }

  @SubscribeMessage(GameSocketClientEvent.BuildCity)
  public handleBuildCity(
    @MessageBody() payload: BuildCityWsDto,
    @ConnectedSocket() client: Socket,
  ): void {
    this.gameplayHandlers.buildCity(this.server, client, payload);
  }

  @SubscribeMessage(GameSocketClientEvent.BuyDevCard)
  public handleBuyDevCard(
    @MessageBody() payload: LobbyIdWsDto,
    @ConnectedSocket() client: Socket,
  ): void {
    this.gameplayHandlers.buyDevCard(this.server, client, payload);
  }

  @SubscribeMessage(GameSocketClientEvent.PlayKnight)
  public handlePlayKnight(
    @MessageBody() payload: PlayKnightWsDto,
    @ConnectedSocket() client: Socket,
  ): void {
    this.gameplayHandlers.playKnight(this.server, client, payload);
  }

  @SubscribeMessage(GameSocketClientEvent.PlayMonopoly)
  public handlePlayMonopoly(
    @MessageBody() payload: PlayMonopolyWsDto,
    @ConnectedSocket() client: Socket,
  ): void {
    this.gameplayHandlers.playMonopoly(this.server, client, payload);
  }

  @SubscribeMessage(GameSocketClientEvent.PlayYearOfPlenty)
  public handlePlayYearOfPlenty(
    @MessageBody() payload: PlayYearOfPlentyWsDto,
    @ConnectedSocket() client: Socket,
  ): void {
    this.gameplayHandlers.playYearOfPlenty(this.server, client, payload);
  }

  @SubscribeMessage(GameSocketClientEvent.PlayRoadBuilding)
  public handlePlayRoadBuilding(
    @MessageBody() payload: PlayRoadBuildingWsDto,
    @ConnectedSocket() client: Socket,
  ): void {
    this.gameplayHandlers.playRoadBuilding(this.server, client, payload);
  }

  @SubscribeMessage(GameSocketClientEvent.BankTrade)
  public handleBankTrade(
    @MessageBody() payload: BankTradeWsDto,
    @ConnectedSocket() client: Socket,
  ): void {
    this.tradeHandlers.bankTrade(this.server, client, payload);
  }

  @SubscribeMessage(GameSocketClientEvent.RollDice)
  public handleRollDice(
    @MessageBody() payload: LobbyIdWsDto,
    @ConnectedSocket() client: Socket,
  ): void {
    this.gameplayHandlers.rollDice(this.server, client, payload);
  }

  @SubscribeMessage(GameSocketClientEvent.RobberDiscard)
  public handleRobberDiscard(
    @MessageBody() payload: RobberDiscardWsDto,
    @ConnectedSocket() client: Socket,
  ): void {
    this.gameplayHandlers.robberDiscard(this.server, client, payload);
  }

  @SubscribeMessage(GameSocketClientEvent.MoveRobber)
  public handleMoveRobber(
    @MessageBody() payload: MoveRobberWsDto,
    @ConnectedSocket() client: Socket,
  ): void {
    this.gameplayHandlers.moveRobber(this.server, client, payload);
  }

  @SubscribeMessage(GameSocketClientEvent.FinishTrading)
  public handleFinishTrading(
    @MessageBody() payload: LobbyIdWsDto,
    @ConnectedSocket() client: Socket,
  ): void {
    this.tradeHandlers.finishTrading(this.server, client, payload);
  }

  @SubscribeMessage(GameSocketClientEvent.EndTurn)
  public handleEndTurn(
    @MessageBody() payload: LobbyIdWsDto,
    @ConnectedSocket() client: Socket,
  ): void {
    this.gameplayHandlers.endTurn(this.server, client, payload);
  }

  @SubscribeMessage(GameSocketClientEvent.TradePropose)
  public handleTradePropose(
    @MessageBody() payload: TradeProposeWsDto,
    @ConnectedSocket() client: Socket,
  ): void {
    this.tradeHandlers.tradePropose(this.server, client, payload);
  }

  @SubscribeMessage(GameSocketClientEvent.TradeAccept)
  public handleTradeAccept(
    @MessageBody() payload: TradeIdWsDto,
    @ConnectedSocket() client: Socket,
  ): void {
    this.tradeHandlers.tradeAccept(this.server, client, payload);
  }

  @SubscribeMessage(GameSocketClientEvent.TradeReject)
  public handleTradeReject(
    @MessageBody() payload: TradeIdWsDto,
    @ConnectedSocket() client: Socket,
  ): void {
    this.tradeHandlers.tradeReject(this.server, client, payload);
  }

  @SubscribeMessage(GameSocketClientEvent.TradeCounter)
  public handleTradeCounter(
    @MessageBody() payload: TradeCounterWsDto,
    @ConnectedSocket() client: Socket,
  ): void {
    this.tradeHandlers.tradeCounter(this.server, client, payload);
  }

  @SubscribeMessage(GameSocketClientEvent.TradeFinalize)
  public handleTradeFinalize(
    @MessageBody() payload: TradeFinalizeWsDto,
    @ConnectedSocket() client: Socket,
  ): void {
    this.tradeHandlers.tradeFinalize(this.server, client, payload);
  }
}
