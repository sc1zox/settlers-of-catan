import { Module } from '@nestjs/common';
import { DevCardsService } from './dev-cards.service';
import { GameActionValidationModule } from '../validation/game-action-validation.module';

@Module({
  imports: [GameActionValidationModule],
  providers: [DevCardsService],
  exports: [DevCardsService],
})
export class DevCardsModule {}
