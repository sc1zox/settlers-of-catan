import { Module } from '@nestjs/common';
import { BuildActionService } from './build-action.service';
import { EconomyModule } from '../economy/economy.module';
import { GameActionValidationModule } from '../validation/game-action-validation.module';
import { TurnFlowModule } from '../turn/turn-flow.module';

@Module({
  imports: [GameActionValidationModule, TurnFlowModule, EconomyModule],
  providers: [BuildActionService],
  exports: [BuildActionService],
})
export class BuildActionsModule {}
