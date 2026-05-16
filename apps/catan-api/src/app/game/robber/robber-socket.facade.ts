import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { PlayerSeat, ResourceType } from '@catan/api-interfaces';
import { GameService } from '../core/game.service';

@Injectable()
export class RobberSocketFacade {
  public constructor(private readonly gameService: GameService) {}

  public submitRobberDiscard(
    lobbyId: string,
    sessionToken: string,
    discard: Readonly<Partial<Record<ResourceType, number>>>,
    server: Server,
  ): void {
    this.gameService.submitRobberDiscard(lobbyId, sessionToken, discard, server);
  }

  public moveRobber(
    lobbyId: string,
    sessionToken: string,
    q: number,
    r: number,
    victimSeat: PlayerSeat | undefined,
    server: Server,
  ): void {
    this.gameService.moveRobber(lobbyId, sessionToken, q, r, victimSeat, server);
  }

  public playKnight(
    lobbyId: string,
    sessionToken: string,
    q: number,
    r: number,
    victimSeat: PlayerSeat | undefined,
    server: Server,
  ): void {
    this.gameService.playKnight(lobbyId, sessionToken, q, r, victimSeat, server);
  }
}
