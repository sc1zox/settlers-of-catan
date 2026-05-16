import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { GameService } from '../core/game.service';

@Injectable()
export class LobbySocketFacade {
  public constructor(private readonly gameService: GameService) {}

  public startLobby(lobbyId: string, sessionToken: string, server: Server): void {
    this.gameService.startLobby(lobbyId, sessionToken, server);
  }

  public fillLobbyWithBots(lobbyId: string, sessionToken: string, server: Server): void {
    this.gameService.fillLobbyWithBots(lobbyId, sessionToken, server);
  }
}
