import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { GameActionValidationModule } from '../validation/game-action-validation.module';
import { BotLogicService } from './bot-logic.service';
import { BotManagementService } from './bot-management.service';

@Module({
  imports: [GameActionValidationModule],
  providers: [BotService, BotLogicService, BotManagementService],
  exports: [BotService, BotLogicService, BotManagementService],
})
export class BotModule {}
