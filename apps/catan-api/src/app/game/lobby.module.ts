import { Module } from '@nestjs/common';
import { DemoBotModule } from './demo-bot.module';
import { GameActionValidationModule } from './game-action-validation.module';
import { LobbyService } from './lobby.service';

@Module({
  imports: [DemoBotModule, GameActionValidationModule],
  providers: [LobbyService],
  exports: [LobbyService],
})
export class LobbyModule {}
