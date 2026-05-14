import { randomInt } from 'node:crypto';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import {
  BoardLayoutPayload,
  GameSocketClientEvent,
  GameSocketServerEvent,
  JoinSessionPayload,
  makeStandardLandPlacements,
  SessionJoinedPayload,
} from '@catan/shared-game-field';
import { Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/game',
})
export class GameGateway {
  private readonly sessionSeeds = new Map<string, number>();

  @SubscribeMessage(GameSocketClientEvent.JoinSession)
  public async handleJoin(
    @MessageBody() payload: JoinSessionPayload,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const sessionId = payload.sessionId.trim() || 'default';
    let seed = this.sessionSeeds.get(sessionId);
    if (seed === undefined) {
      seed = randomInt(0, 0xffffffff);
      this.sessionSeeds.set(sessionId, seed);
    }
    const room = `session:${sessionId}`;
    await client.join(room);
    const joined: SessionJoinedPayload = { sessionId };
    client.emit(GameSocketServerEvent.SessionJoined, joined);
    const tiles = makeStandardLandPlacements(seed);
    const board: BoardLayoutPayload = { seed, tiles };
    client.emit(GameSocketServerEvent.BoardLayout, board);
  }
}
