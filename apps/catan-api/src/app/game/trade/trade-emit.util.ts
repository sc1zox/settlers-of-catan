import {
  GameSocketServerEvent,
  PlayerSeat,
  type TradeUpdatedPayload,
} from '@catan/api-interfaces';
import type { Server } from 'socket.io';
import type { LobbyRuntime } from '../lobby/lobby-runtime';

/**
 * Push a `TradeUpdated` only to sockets that have a stake in the thread —
 * the sender and the listed recipients. Spectators / uninvolved seats don't
 * need to hear about someone else's trade graph at all, and the client used
 * to filter these out defensively; doing it at the source keeps wire traffic
 * tight and frees the client of that responsibility.
 */
export function emitTradeUpdatedToInvolvedSockets(
  server: Server,
  lobby: LobbyRuntime,
  payload: TradeUpdatedPayload,
): void {
  const involved = new Set<PlayerSeat>();
  involved.add(payload.trade.fromSeat);
  for (let i = 0; i < payload.trade.recipients.length; i += 1) {
    involved.add(payload.trade.recipients[i].seat);
  }
  for (let i = 0; i < lobby.players.length; i += 1) {
    const player = lobby.players[i];
    if (!involved.has(player.seat) || player.socketId === null) {
      continue;
    }
    server.to(player.socketId).emit(GameSocketServerEvent.TradeUpdated, payload);
  }
}

