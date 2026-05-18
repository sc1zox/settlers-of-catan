import { Module } from '@nestjs/common';
import { TradeActionsService } from './trade-actions.service';
import { TradeReconnectService } from './trade-reconnect.service';
import { TradeService } from './trade.service';

@Module({
  providers: [TradeService, TradeActionsService, TradeReconnectService],
  exports: [TradeService, TradeActionsService, TradeReconnectService],
})
export class TradeModule {}
