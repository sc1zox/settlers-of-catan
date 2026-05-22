import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { BotModule } from '../bot/bot.module';
import { LobbyModule } from '../lobby/lobby.module';
import { ReconnectModule } from '../reconnect/reconnect.module';
import { LobbyOrchestratorService } from './lobby-orchestrator.service';

@Module({
  imports: [LobbyModule, BotModule, InfrastructureModule, ReconnectModule],
  providers: [LobbyOrchestratorService],
  exports: [LobbyOrchestratorService],
})
export class LobbyOrchestratorModule {}
