import { Module } from '@nestjs/common';
import { LobbyModule } from '../lobby/lobby.module';
import { TradeModule } from '../trade/trade.module';
import { ReconnectService } from './reconnect.service';

@Module({
  imports: [LobbyModule, TradeModule],
  providers: [ReconnectService],
  exports: [ReconnectService],
})
export class ReconnectModule {}
