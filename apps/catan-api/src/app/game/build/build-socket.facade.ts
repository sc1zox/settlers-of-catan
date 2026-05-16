import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { GameService } from '../core/game.service';

@Injectable()
export class BuildSocketFacade {
  public constructor(private readonly gameService: GameService) {}

  public buildSettlement(
    lobbyId: string,
    sessionToken: string,
    vertexId: string,
    server: Server,
  ): void {
    this.gameService.buildSettlement(lobbyId, sessionToken, vertexId, server);
  }

  public buildRoad(
    lobbyId: string,
    sessionToken: string,
    edgeId: string,
    server: Server,
  ): void {
    this.gameService.buildRoad(lobbyId, sessionToken, edgeId, server);
  }

  public buildCity(
    lobbyId: string,
    sessionToken: string,
    vertexId: string,
    server: Server,
  ): void {
    this.gameService.buildCity(lobbyId, sessionToken, vertexId, server);
  }

  public playRoadBuilding(
    lobbyId: string,
    sessionToken: string,
    firstEdgeId: string,
    secondEdgeId: string | undefined,
    server: Server,
  ): void {
    this.gameService.playRoadBuilding(lobbyId, sessionToken, firstEdgeId, secondEdgeId, server);
  }
}
