import { Module } from '@nestjs/common';
import { EconomyService } from './economy.service';
import { ResourceCostService } from './resource-cost.service';
import { GameActionValidationModule } from '../validation/game-action-validation.module';
import { RobberModule } from '../robber/robber.module';

@Module({
  imports: [GameActionValidationModule, RobberModule],
  providers: [EconomyService, ResourceCostService],
  exports: [EconomyService, ResourceCostService],
})
export class EconomyModule {}
