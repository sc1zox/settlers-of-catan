import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { GameService } from '../core/game.service';

@Injectable()
export class TurnSocketFacade {
  public constructor(private readonly gameService: GameService) {}

  public startLobby(lobbyId: string, sessionToken: string, server: Server): void {
    this.gameService.startLobby(lobbyId, sessionToken, server);
  }

  public fillLobbyWithBots(lobbyId: string, sessionToken: string, server: Server): void {
    this.gameService.fillLobbyWithBots(lobbyId, sessionToken, server);
  }

  public rollDice(lobbyId: string, sessionToken: string, server: Server): void {
    this.gameService.rollDice(lobbyId, sessionToken, server);
  }

  public endTurn(lobbyId: string, sessionToken: string, server: Server): void {
    this.gameService.endTurn(lobbyId, sessionToken, server);
  }
}
