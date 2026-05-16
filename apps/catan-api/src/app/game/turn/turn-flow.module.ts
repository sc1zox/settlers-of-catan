import { Module } from '@nestjs/common';
import { TurnFlowService } from './turn-flow.service';

@Module({
  providers: [TurnFlowService],
  exports: [TurnFlowService],
})
export class TurnFlowModule {}
