import {
  BankTradePayload,
  BuildCityPayload,
  BuildRoadPayload,
  BuildSettlementPayload,
  BuyDevCardPayload,
  CreateLobbyPayload,
  EndTurnPayload,
  FillLobbyWithBotsPayload,
  FinishTradingPayload,
  GameSocketClientEvent,
  JoinLobbyPayload,
  KickAndReplaceWithBotPayload,
  LeaveLobbyPayload,
  MoveRobberPayload,
  PlayKnightPayload,
  PlayMonopolyPayload,
  PlayRoadBuildingPayload,
  PlayYearOfPlentyPayload,
  RobberDiscardPayload,
  RollDicePayload,
  SocketGatewayNamespace,
  StartLobbyPayload,
  TradeAcceptPayload,
  TradeCounterPayload,
  TradeFinalizePayload,
  TradeProposePayload,
  TradeRejectPayload,
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
import { SocketConnectionRegistry } from './socket-connection.registry';
import { resolveSocketIoCors } from '../../http/cors-env.util';
import { GatewayActionRejectService, GatewaySocketSessionService } from './gateway-common.services';
import { GatewayAuthService } from './gateway-auth.service';
import { GatewayGameplayHandlers } from './gateway-gameplay.handlers';
import { GatewayLobbyHandlers } from './gateway-lobby.handlers';
import { GatewayTradeHandlers } from './gateway-trade.handlers';

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
    private readonly gatewayAuth: GatewayAuthService,
    private readonly reject: GatewayActionRejectService,
    private readonly sessions: GatewaySocketSessionService,
    private readonly lobbyHandlers: GatewayLobbyHandlers,
    private readonly gameplayHandlers: GatewayGameplayHandlers,
    private readonly tradeHandlers: GatewayTradeHandlers,
  ) {}

  public async handleConnection(client: Socket): Promise<void> {
    if (!this.gatewayAuth.bindHandshakeSession(client, this.registry)) {
      client.disconnect(true);
    }
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
      await this.lobbyHandlers.joinLobby(this.server, client, payload);
    } catch (e) {
      this.reject.emit(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.CreateLobby)
  public async handleCreateLobby(
    @MessageBody() payload: CreateLobbyPayload,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      await this.lobbyHandlers.createLobby(this.server, client, payload);
    } catch (e) {
      this.reject.emit(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.BuildSettlement)
  public handleBuildSettlement(
    @MessageBody() payload: BuildSettlementPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      this.gameplayHandlers.buildSettlement(this.server, client, payload);
    } catch (e) {
      this.reject.emit(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.LeaveLobby)
  public async handleLeaveLobby(
    @MessageBody() payload: LeaveLobbyPayload,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      await this.lobbyHandlers.leaveLobby(this.server, client, payload);
    } catch (e) {
      this.reject.emit(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.StartLobby)
  public handleStartLobby(
    @MessageBody() payload: StartLobbyPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      this.lobbyHandlers.startLobby(this.server, client, payload);
    } catch (e) {
      this.reject.emit(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.FillLobbyWithBots)
  public handleFillLobbyWithBots(
    @MessageBody() payload: FillLobbyWithBotsPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      this.lobbyHandlers.fillLobbyWithBots(this.server, client, payload);
    } catch (e) {
      this.reject.emit(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.KickAndReplaceWithBot)
  public handleKickAndReplaceWithBot(
    @MessageBody() payload: KickAndReplaceWithBotPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      this.lobbyHandlers.kickAndReplaceWithBot(this.server, client, payload);
    } catch (e) {
      this.reject.emit(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.BuildRoad)
  public handleBuildRoad(
    @MessageBody() payload: BuildRoadPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      this.gameplayHandlers.buildRoad(this.server, client, payload);
    } catch (e) {
      this.reject.emit(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.BuildCity)
  public handleBuildCity(
    @MessageBody() payload: BuildCityPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      this.gameplayHandlers.buildCity(this.server, client, payload);
    } catch (e) {
      this.reject.emit(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.BuyDevCard)
  public handleBuyDevCard(
    @MessageBody() payload: BuyDevCardPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      this.gameplayHandlers.buyDevCard(this.server, client, payload);
    } catch (e) {
      this.reject.emit(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.PlayKnight)
  public handlePlayKnight(
    @MessageBody() payload: PlayKnightPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      this.gameplayHandlers.playKnight(this.server, client, payload);
    } catch (e) {
      this.reject.emit(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.PlayMonopoly)
  public handlePlayMonopoly(
    @MessageBody() payload: PlayMonopolyPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      this.gameplayHandlers.playMonopoly(this.server, client, payload);
    } catch (e) {
      this.reject.emit(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.PlayYearOfPlenty)
  public handlePlayYearOfPlenty(
    @MessageBody() payload: PlayYearOfPlentyPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      this.gameplayHandlers.playYearOfPlenty(this.server, client, payload);
    } catch (e) {
      this.reject.emit(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.PlayRoadBuilding)
  public handlePlayRoadBuilding(
    @MessageBody() payload: PlayRoadBuildingPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      this.gameplayHandlers.playRoadBuilding(this.server, client, payload);
    } catch (e) {
      this.reject.emit(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.BankTrade)
  public handleBankTrade(
    @MessageBody() payload: BankTradePayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      this.tradeHandlers.bankTrade(this.server, client, payload);
    } catch (e) {
      this.reject.emit(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.RollDice)
  public handleRollDice(
    @MessageBody() payload: RollDicePayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      this.gameplayHandlers.rollDice(this.server, client, payload);
    } catch (e) {
      this.reject.emit(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.RobberDiscard)
  public handleRobberDiscard(
    @MessageBody() payload: RobberDiscardPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      this.gameplayHandlers.robberDiscard(this.server, client, payload);
    } catch (e) {
      this.reject.emit(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.MoveRobber)
  public handleMoveRobber(
    @MessageBody() payload: MoveRobberPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      this.gameplayHandlers.moveRobber(this.server, client, payload);
    } catch (e) {
      this.reject.emit(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.FinishTrading)
  public handleFinishTrading(
    @MessageBody() payload: FinishTradingPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      this.tradeHandlers.finishTrading(this.server, client, payload);
    } catch (e) {
      this.reject.emit(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.EndTurn)
  public handleEndTurn(
    @MessageBody() payload: EndTurnPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      this.gameplayHandlers.endTurn(this.server, client, payload);
    } catch (e) {
      this.reject.emit(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.TradePropose)
  public handleTradePropose(
    @MessageBody() payload: TradeProposePayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      this.tradeHandlers.tradePropose(this.server, client, payload);
    } catch (e) {
      this.reject.emit(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.TradeAccept)
  public handleTradeAccept(
    @MessageBody() payload: TradeAcceptPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      this.tradeHandlers.tradeAccept(this.server, client, payload);
    } catch (e) {
      this.reject.emit(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.TradeReject)
  public handleTradeReject(
    @MessageBody() payload: TradeRejectPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      this.tradeHandlers.tradeReject(this.server, client, payload);
    } catch (e) {
      this.reject.emit(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.TradeCounter)
  public handleTradeCounter(
    @MessageBody() payload: TradeCounterPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      this.tradeHandlers.tradeCounter(this.server, client, payload);
    } catch (e) {
      this.reject.emit(client, e);
    }
  }

  @SubscribeMessage(GameSocketClientEvent.TradeFinalize)
  public handleTradeFinalize(
    @MessageBody() payload: TradeFinalizePayload,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      this.tradeHandlers.tradeFinalize(this.server, client, payload);
    } catch (e) {
      this.reject.emit(client, e);
    }
  }
}
