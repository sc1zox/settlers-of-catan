import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { TradeModule } from '../trade/trade.module';
import { GameActionValidationModule } from '../validation/game-action-validation.module';
import { LobbyService } from './lobby.service';

@Module({
  imports: [GameActionValidationModule, InfrastructureModule, TradeModule],
  providers: [LobbyService],
  exports: [LobbyService],
})
export class LobbyModule {}
