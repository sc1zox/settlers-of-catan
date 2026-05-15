import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { LobbyController } from './lobby.controller';

@Module({
  imports: [InfrastructureModule],
  controllers: [LobbyController],
})
export class LobbyHttpModule {}
