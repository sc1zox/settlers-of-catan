import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import {
  ActionRejectCode,
  ActionRejectedPayload,
  GameSocketServerEvent,
} from '@catan/api-interfaces';
import { GameService } from '../core/game.service';
import { SocketConnectionRegistry } from './socket-connection.registry';

@Injectable()
export class GatewayActionRejectService {
  public constructor(private readonly gameService: GameService) {}

  public emit(client: Socket, error: unknown): void {
    const { code, message } = this.gameService.describeError(error);
    const payload: ActionRejectedPayload = { code, message };
    client.emit(GameSocketServerEvent.ActionRejected, payload);
  }
}

@Injectable()
export class GatewaySocketSessionService {
  public constructor(private readonly registry: SocketConnectionRegistry) {}

  public getSessionToken(client: Socket): string | undefined {
    return this.registry.getSessionToken(client.id);
  }

  public requireSessionToken(client: Socket): string {
    const sessionToken = this.getSessionToken(client);
    if (!sessionToken) {
      throw new Error(ActionRejectCode.PlayerNotInLobby);
    }
    return sessionToken;
  }
}
