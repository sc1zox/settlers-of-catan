import { Module } from '@nestjs/common';
import { EconomyService } from './economy.service';
import { GameActionValidationModule } from './game-action-validation.module';
import { RobberModule } from './robber.module';

@Module({
  imports: [GameActionValidationModule, RobberModule],
  providers: [EconomyService],
  exports: [EconomyService],
})
export class EconomyModule {}
