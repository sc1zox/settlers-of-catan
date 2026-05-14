import { Module } from '@nestjs/common';
import { BuildActionsModule } from './build-actions.module';
import { DemoBotModule } from './demo-bot.module';
import { EconomyModule } from './economy.module';
import { GameActionValidationModule } from './game-action-validation.module';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { LobbyModule } from './lobby.module';
import { MatchFlowModule } from './match-flow.module';
import { RobberModule } from './robber.module';
import { SocketConnectionRegistry } from './socket-connection.registry';
import { TradeModule } from './trade.module';
import { TurnFlowModule } from './turn-flow.module';

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
