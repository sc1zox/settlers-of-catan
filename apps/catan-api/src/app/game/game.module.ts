import { Module } from '@nestjs/common';
import { BuildActionsModule } from './build/build-actions.module';
import { BotModule } from ../bot/bot.module';
import { DevCardsModule } from './dev-cards/dev-cards.module';
import { EconomyModule } from './economy/economy.module';
import { GameActionValidationModule } from './validation/game-action-validation.module';
import { GameGateway } from './gateway/game.gateway';
import { GameGatewayExceptionFilter } from './gateway/game-gateway-exception.filter';
import { GatewayAuthService } from './gateway/gateway-auth.service';
import {
  GatewayActionRejectService,
  GatewaySocketSessionService,
} from './gateway/gateway-common.services';
import { GatewayGameplayHandlers } from './gateway/gateway-gameplay.handlers';
import { GatewayLobbyHandlers } from './gateway/gateway-lobby.handlers';
import { GatewayTradeHandlers } from './gateway/gateway-trade.handlers';
import { GameService } from './core/game.service';
import { LobbyModule } from './lobby/lobby.module';
import { LobbyOrchestratorModule } from './lobby-orchestrator/lobby-orchestrator.module';
import { MatchFlowModule } from './match-flow/match-flow.module';
import { ReconnectModule } from './reconnect/reconnect.module';
import { RobberModule } from './robber/robber.module';
import { SocketConnectionRegistry } from './gateway/socket-connection.registry';
import { TradeGatewayService } from './trade/trade-gateway.service';
import { TradeModule } from './trade/trade.module';
import { TurnFlowModule } from './turn/turn-flow.module';

@Module({
  imports: [
    LobbyModule,
    LobbyOrchestratorModule,
    MatchFlowModule,
    ReconnectModule,
    RobberModule,
    BotModule,
    DevCardsModule,
    GameActionValidationModule,
    TradeModule,
    TurnFlowModule,
    EconomyModule,
    BuildActionsModule,
  ],
  providers: [
    GameGateway,
    GameService,
    SocketConnectionRegistry,
    TradeGatewayService,
    GameGatewayExceptionFilter,
    GatewayAuthService,
    GatewayActionRejectService,
    GatewaySocketSessionService,
    GatewayLobbyHandlers,
    GatewayGameplayHandlers,
    GatewayTradeHandlers,
  ],
})
export class GameModule {}
