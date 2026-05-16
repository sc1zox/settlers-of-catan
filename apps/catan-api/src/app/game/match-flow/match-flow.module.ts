import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { GameActionValidationModule } from '../validation/game-action-validation.module';
import { MatchFlowService } from './match-flow.service';
import { TradeModule } from '../trade/trade.module';
import { TurnFlowModule } from '../turn/turn-flow.module';

@Module({
  imports: [GameActionValidationModule, TradeModule, TurnFlowModule, EconomyModule],
  providers: [MatchFlowService],
  exports: [MatchFlowService],
})
export class MatchFlowModule {}
