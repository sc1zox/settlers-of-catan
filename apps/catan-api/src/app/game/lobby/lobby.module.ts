import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { GameActionValidationModule } from '../validation/game-action-validation.module';
import { LobbyService } from './lobby.service';

@Module({
  imports: [GameActionValidationModule, InfrastructureModule],
  providers: [LobbyService],
  exports: [LobbyService],
})
export class LobbyModule {}
