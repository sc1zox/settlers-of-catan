import { Module } from '@nestjs/common';
import { GameActionValidationModule } from '../validation/game-action-validation.module';
import { RobberService } from './robber.service';

@Module({
  imports: [GameActionValidationModule],
  providers: [RobberService],
  exports: [RobberService],
})
export class RobberModule {}
