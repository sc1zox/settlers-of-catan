import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { DemoBotModule } from '../demo-bot/demo-bot.module';
import { LobbyModule } from '../lobby/lobby.module';
import { TradeModule } from '../trade/trade.module';
import { ReconnectService } from './reconnect.service';

@Module({
  imports: [LobbyModule, TradeModule, InfrastructureModule, DemoBotModule],
  providers: [ReconnectService],
  exports: [ReconnectService],
})
export class ReconnectModule {}
