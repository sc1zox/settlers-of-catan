import { Module } from '@nestjs/common';
import { GameActionValidationService } from './game-action-validation.service';

@Module({
  providers: [GameActionValidationService],
  exports: [GameActionValidationService],
})
export class GameActionValidationModule {}
