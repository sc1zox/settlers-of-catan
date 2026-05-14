import { Module } from '@nestjs/common';
import { GameActionValidationService } from './game-action-validation.service';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { SocketConnectionRegistry } from './socket-connection.registry';
import { TradeService } from './trade.service';

@Module({
  providers: [
    GameGateway,
    GameService,
    TradeService,
    GameActionValidationService,
    SocketConnectionRegistry,
  ],
})
export class GameModule {}
