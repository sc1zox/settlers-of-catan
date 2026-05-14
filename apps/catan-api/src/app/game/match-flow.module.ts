import { Module } from '@nestjs/common';
import { DemoBotModule } from './demo-bot.module';
import { EconomyModule } from './economy.module';
import { GameActionValidationModule } from './game-action-validation.module';
import { MatchFlowService } from './match-flow.service';
import { TradeModule } from './trade.module';
import { TurnFlowModule } from './turn-flow.module';

@Module({
  imports: [DemoBotModule, GameActionValidationModule, TradeModule, TurnFlowModule, EconomyModule],
  providers: [MatchFlowService],
  exports: [MatchFlowService],
})
export class MatchFlowModule {}
