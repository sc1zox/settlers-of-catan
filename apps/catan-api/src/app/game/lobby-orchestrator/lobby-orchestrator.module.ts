import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { DemoBotModule } from '../demo-bot/demo-bot.module';
import { LobbyModule } from '../lobby/lobby.module';
import { LobbyOrchestratorService } from './lobby-orchestrator.service';

@Module({
  imports: [LobbyModule, DemoBotModule, InfrastructureModule],
  providers: [LobbyOrchestratorService],
  exports: [LobbyOrchestratorService],
})
export class LobbyOrchestratorModule {}
