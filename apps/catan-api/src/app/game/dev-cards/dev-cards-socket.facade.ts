import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { ResourceType } from '@catan/api-interfaces';
import { GameService } from '../core/game.service';

@Injectable()
export class DevCardsSocketFacade {
  public constructor(private readonly gameService: GameService) {}

  public buyDevCard(lobbyId: string, sessionToken: string, server: Server): void {
    this.gameService.buyDevCard(lobbyId, sessionToken, server);
  }

  public playMonopoly(
    lobbyId: string,
    sessionToken: string,
    resource: ResourceType,
    server: Server,
  ): void {
    this.gameService.playMonopoly(lobbyId, sessionToken, resource, server);
  }

  public playYearOfPlenty(
    lobbyId: string,
    sessionToken: string,
    first: ResourceType,
    second: ResourceType,
    server: Server,
  ): void {
    this.gameService.playYearOfPlenty(lobbyId, sessionToken, first, second, server);
  }
}
