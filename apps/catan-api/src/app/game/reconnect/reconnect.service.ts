import { Injectable } from '@nestjs/common';
import {
  GameSocketServerEvent,
  PlayerSeat,
  TradeUpdateKind,
  type TradeOfferDto,
  type TradeUpdatedPayload,
} from '@catan/api-interfaces';
import type { Server } from 'socket.io';
import type { LobbyRuntime } from '../lobby/lobby-runtime';
import { LobbyService } from '../lobby/lobby.service';
import { TradeService } from '../trade/trade.service';

/**
 * Single entry point for "a socket just bound to a lobby — bring it up to
 * speed". Covers fresh joins, rejoins, and post-disconnect reconnects; the
 * call sites don't need to know which one happened, only that they need to
 * resync. Adding a new ephemeral state that doesn't live in FullState
 * (queued chat replay, in-flight animation cues, …) means adding one
 * private helper here, not threading a new collaborator through the
 * orchestrator + every gateway handler.
 */
@Injectable()
export class ReconnectService {
  public constructor(
    private readonly lobby: LobbyService,
    private readonly trades: TradeService,
  ) {}

  /**
   * Pushes everything the freshly-bound socket needs:
   *  1. FullState (board snapshot, broadcast to the whole lobby because the
   *     join/reconnect itself flipped this seat's `isConnected`).
   *  2. Trade resync targeted only at this socket — re-emit any open thread
   *     involving the seat so the client cache picks up trades that started
   *     while it was offline.
   *
   * Order matters: FullState first so the seat-context (selfSeat etc.) is
   * authoritative before the trade resync lands.
   */
  public syncSocketIntoLobby(
    server: Server,
    lobby: LobbyRuntime,
    socketId: string,
    seat: PlayerSeat,
  ): void {
    this.lobby.broadcastFullState(server, lobby);
    this.resyncOpenTradesForSocket(server, lobby.lobbyId, socketId, seat);
  }

  private resyncOpenTradesForSocket(
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
