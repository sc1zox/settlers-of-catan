import { Injectable } from '@nestjs/common';
import {
  BankTradePayload,
  FinishTradingPayload,
  TradeAcceptPayload,
  TradeCounterPayload,
  TradeFinalizePayload,
  TradeProposePayload,
  TradeRejectPayload,
  TradeWithdrawCounterPayload,
} from '@catan/api-interfaces';
import { Server } from 'socket.io';
import { GameService } from '../core/game.service';
import { BotService } from '../bot/bot.service';
import type { LobbyRuntime } from '../lobby/lobby-runtime';
import { TradeActionsService, type TradeActionResult } from './trade-actions.service';
import { emitTradeUpdatedToInvolvedSockets } from './trade-emit.util';

@Injectable()
export class TradeGatewayService {
  public constructor(
    private readonly gameService: GameService,
    private readonly tradeActions: TradeActionsService,
    private readonly demoBots: BotService,
  ) {}

  public bankTrade(server: Server, payload: BankTradePayload, sessionToken: string): void {
    this.gameService.bankTrade(
      payload.lobbyId,
      sessionToken,
      payload.giveResource,
      payload.giveAmount,
      payload.receiveResource,
      server,
    );
  }

  public finishTrading(server: Server, payload: FinishTradingPayload, sessionToken: string): void {
    this.gameService.finishTrading(payload.lobbyId, sessionToken, server);
  }

  public proposeTrade(server: Server, payload: TradeProposePayload, sessionToken: string): void {
    const result = this.tradeActions.proposeTrade(
      this.tradeActionContext(server),
      sessionToken,
      payload,
    );
    this.broadcastResult(server, result);
    const tradeUpdate = result.updates[0];
    if (tradeUpdate === undefined) {
      return;
    }
    const lobby = this.gameService.getLobby(payload.lobbyId);
    if (lobby === undefined) {
      return;
    }
    const ctx = this.tradeActionContext(server);
    this.demoBots.respondToTradePropose(
      lobby,
      tradeUpdate.trade.recipients,
      (botSession) => {
        const accepted = this.tradeActions.acceptTrade(ctx, botSession, {
          lobbyId: payload.lobbyId,
          tradeId: tradeUpdate.trade.id,
        });
        this.broadcastResult(server, accepted);
      },
      (botSession) => {
        const rejected = this.tradeActions.rejectTrade(ctx, botSession, {
          lobbyId: payload.lobbyId,
          tradeId: tradeUpdate.trade.id,
        });
        this.broadcastResult(server, rejected);
      },
    );
  }

  public acceptTrade(server: Server, payload: TradeAcceptPayload, sessionToken: string): void {
    const result = this.tradeActions.acceptTrade(
      this.tradeActionContext(server),
      sessionToken,
      payload,
    );
    this.broadcastResult(server, result);
  }

  public rejectTrade(server: Server, payload: TradeRejectPayload, sessionToken: string): void {
    const result = this.tradeActions.rejectTrade(
      this.tradeActionContext(server),
      sessionToken,
      payload,
    );
    this.broadcastResult(server, result);
  }

  public counterTrade(server: Server, payload: TradeCounterPayload, sessionToken: string): void {
    const result = this.tradeActions.counterTrade(
      this.tradeActionContext(server),
      sessionToken,
      payload,
    );
    this.broadcastResult(server, result);
  }

  public withdrawCounterTrade(
    server: Server,
    payload: TradeWithdrawCounterPayload,
    sessionToken: string,
  ): void {
    const result = this.tradeActions.withdrawCounterTrade(
      this.tradeActionContext(server),
      sessionToken,
      payload,
    );
    this.broadcastResult(server, result);
  }

  public finalizeTrade(server: Server, payload: TradeFinalizePayload, sessionToken: string): void {
    const result = this.tradeActions.finalizeTrade(
      this.tradeActionContext(server),
      sessionToken,
      payload,
    );
    this.broadcastResult(server, result);
  }

  private broadcastResult(server: Server, result: TradeActionResult): void {
    // Trade deltas only — FullState stays out of this path. The board hasn't
    // changed; only the trade graph has. Client mirrors `activeTrades` from
    // these TradeUpdated events. Actions that ALSO move resources (e.g.
    // finalize) push a FullState themselves alongside.
    if (result.cancelled.length === 0 && result.updates.length === 0) {
      return;
    }
    const lobby = this.gameService.getLobby(result.lobbyId);
    if (lobby === undefined) {
      return;
    }
    for (let i = 0; i < result.cancelled.length; i += 1) {
      emitTradeUpdatedToInvolvedSockets(server, lobby, result.cancelled[i]);
    }
    for (let i = 0; i < result.updates.length; i += 1) {
      emitTradeUpdatedToInvolvedSockets(server, lobby, result.updates[i]);
    }
  }

  private tradeActionContext(server: Server): {
    getLobby: (lobbyId: string) => LobbyRuntime | undefined;
    broadcastLobby: (lobby: LobbyRuntime) => void;
  } {
    return {
      getLobby: (lobbyId: string) => this.gameService.getLobby(lobbyId),
      broadcastLobby: (lobby: LobbyRuntime) => this.gameService.broadcastFullState(server, lobby),
    };
  }
}
