import { Module } from '@nestjs/common';
import { DemoBotService } from './demo-bot.service';
import { GameActionValidationModule } from '../validation/game-action-validation.module';

@Module({
  imports: [GameActionValidationModule],
  providers: [DemoBotService],
  exports: [DemoBotService],
})
export class DemoBotModule {}
