import { Module } from '@nestjs/common';
import { DemoBotModule } from './demo-bot.module';
import { TurnFlowService } from './turn-flow.service';

@Module({
  imports: [DemoBotModule],
  providers: [TurnFlowService],
  exports: [TurnFlowService],
})
export class TurnFlowModule {}
