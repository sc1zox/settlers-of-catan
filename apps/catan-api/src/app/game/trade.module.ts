import { Module } from '@nestjs/common';
import { TradeActionsService } from './trade-actions.service';
import { TradeService } from './trade.service';

@Module({
  providers: [TradeService, TradeActionsService],
  exports: [TradeService, TradeActionsService],
})
export class TradeModule {}
