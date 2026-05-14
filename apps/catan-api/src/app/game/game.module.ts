import { Module } from '@nestjs/common';
import { BuildActionsModule } from './build/build-actions.module';
import { DemoBotModule } from './demo-bot/demo-bot.module';
import { EconomyModule } from './economy/economy.module';
import { GameActionValidationModule } from './validation/game-action-validation.module';
import { GameGateway } from './gateway/game.gateway';
import { GameService } from './core/game.service';
import { LobbyModule } from './lobby/lobby.module';
import { MatchFlowModule } from './match-flow/match-flow.module';
import { RobberModule } from './robber/robber.module';
import { SocketConnectionRegistry } from './gateway/socket-connection.registry';
import { TradeModule } from './trade/trade.module';
import { TurnFlowModule } from './turn/turn-flow.module';

@Module({
  imports: [
    LobbyModule,
    MatchFlowModule,
    RobberModule,
    DemoBotModule,
    GameActionValidationModule,
    TradeModule,
    TurnFlowModule,
    EconomyModule,
    BuildActionsModule,
  ],
  providers: [GameGateway, GameService, SocketConnectionRegistry],
})
export class GameModule {}
