import { Injectable } from '@nestjs/common';
import {
  GameSocketServerEvent,
  PlayerSeat,
  TradeUpdateKind,
  type TradeOfferDto,
  type TradeUpdatedPayload,
} from '@catan/api-interfaces';
import type { Server } from 'socket.io';
import { TradeService } from './trade.service';

/**
 * One-stop shop for re-feeding trade state to a socket that just bound to a
 * lobby — reconnect, rejoin, fresh join. Lives separate from the action
 * facade so the orchestrator / lobby handlers don't reach into the trade
 * store directly, and so any future overhead (rate-limiting, batching,
 * additional resync events) can be added without touching the call sites.
 */
@Injectable()
export class TradeReconnectService {
  public constructor(private readonly trades: TradeService) {}

  /**
   * Push a `TradeUpdated` of kind `Resync` to the given socket for every
   * currently open trade in the lobby that involves the given seat. No-op
   * if the seat isn't in any open trade — most reconnects fall into that
   * bucket, so the cost is one map scan and nothing on the wire.
   */
  public resyncOpenTradesForSocket(
    server: Server,
    lobbyId: string,
    socketId: string,
    seat: PlayerSeat,
  ): void {
    const open = this.trades.findOpenOffersForLobby(lobbyId);
    for (let i = 0; i < open.length; i += 1) {
      const trade = open[i];
      if (!this.tradeInvolvesSeat(trade, seat)) {
        continue;
      }
      const payload: TradeUpdatedPayload = {
        lobbyId: trade.lobbyId,
        trade,
        kind: TradeUpdateKind.Resync,
        actorSeat: trade.fromSeat,
      };
      server.to(socketId).emit(GameSocketServerEvent.TradeUpdated, payload);
    }
  }

  private tradeInvolvesSeat(trade: TradeOfferDto, seat: PlayerSeat): boolean {
    if (trade.fromSeat === seat) {
      return true;
    }
    for (let i = 0; i < trade.recipients.length; i += 1) {
      if (trade.recipients[i].seat === seat) {
        return true;
      }
    }
    return false;
  }
}
