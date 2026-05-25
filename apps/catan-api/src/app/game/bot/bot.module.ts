import { Module } from '@nestjs/common';
import { GameActionValidationModule } from '../validation/game-action-validation.module';
import { BotLogicService } from './bot-logic.service';
import { BotManagementService } from './bot-management.service';

@Module({
  imports: [GameActionValidationModule],
  providers: [BotLogicService, BotManagementService],
  exports: [BotLogicService, BotManagementService],
})
export class BotModule {}
