import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { GameService } from '../core/game.service';

@Injectable()
export class TurnSocketFacade {
  public constructor(private readonly gameService: GameService) {}

  public rollDice(lobbyId: string, sessionToken: string, server: Server): void {
    this.gameService.rollDice(lobbyId, sessionToken, server);
  }

  public endTurn(lobbyId: string, sessionToken: string, server: Server): void {
    this.gameService.endTurn(lobbyId, sessionToken, server);
  }
}
