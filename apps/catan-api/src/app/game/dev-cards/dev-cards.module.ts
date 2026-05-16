import { Module } from '@nestjs/common';
import { DevCardsService } from './dev-cards.service';
import { EconomyModule } from '../economy/economy.module';
import { GameActionValidationModule } from '../validation/game-action-validation.module';

@Module({
  imports: [GameActionValidationModule, EconomyModule],
  providers: [DevCardsService],
  exports: [DevCardsService],
})
export class DevCardsModule {}
