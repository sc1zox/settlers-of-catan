import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { DemoBotModule } from '../demo-bot/demo-bot.module';
import { GameActionValidationModule } from '../validation/game-action-validation.module';
import { LobbyService } from './lobby.service';

@Module({
  imports: [DemoBotModule, GameActionValidationModule, InfrastructureModule],
  providers: [LobbyService],
  exports: [LobbyService],
})
export class LobbyModule {}
