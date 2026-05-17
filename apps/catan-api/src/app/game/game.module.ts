import { Module } from '@nestjs/common';
import { BuildActionsModule } from './build/build-actions.module';
import { BuildSocketFacade } from './build/build-socket.facade';
import { DemoBotModule } from './demo-bot/demo-bot.module';
import { DevCardsModule } from './dev-cards/dev-cards.module';
import { DevCardsSocketFacade } from './dev-cards/dev-cards-socket.facade';
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
import { LobbySocketFacade } from './match-flow/lobby-socket.facade';
import { TurnSocketFacade } from './match-flow/turn-socket.facade';
import { RobberModule } from './robber/robber.module';
import { RobberSocketFacade } from './robber/robber-socket.facade';
import { SocketConnectionRegistry } from './gateway/socket-connection.registry';
import { TradeSocketFacade } from './trade/trade-socket.facade';
import { TradeModule } from './trade/trade.module';
import { TurnFlowModule } from './turn/turn-flow.module';

@Module({
  imports: [
    LobbyModule,
    LobbyOrchestratorModule,
    MatchFlowModule,
    RobberModule,
    DemoBotModule,
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
    TradeSocketFacade,
    GameGatewayExceptionFilter,
    GatewayAuthService,
    GatewayActionRejectService,
    GatewaySocketSessionService,
    GatewayLobbyHandlers,
    GatewayGameplayHandlers,
    GatewayTradeHandlers,
    BuildSocketFacade,
    RobberSocketFacade,
    LobbySocketFacade,
    TurnSocketFacade,
    DevCardsSocketFacade,
  ],
})
export class GameModule {}
