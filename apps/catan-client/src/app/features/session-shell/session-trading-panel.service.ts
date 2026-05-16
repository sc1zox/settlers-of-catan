import { effect, inject, Injectable, signal } from '@angular/core';
import { TradeStatus } from '@catan/api-interfaces';
import { LobbyGameUiStateService } from '../lobby-game-ui/lobby-game-ui-state.service';
import { TradingStateService } from '../trading/trading-state.service';
import type { BankTradeRequest, ProposeTradeRequest } from '../../shared/types/trading-ui.types';

@Injectable()
export class SessionTradingPanelService {
  private readonly tradingState = inject(TradingStateService);
  private readonly lobbyState = inject(LobbyGameUiStateService);

  public readonly tradeOpen = signal<boolean>(false);

  private lastSeenTradeId: string | null = null;
  private lastSeenTradeStatus: TradeStatus | null = null;

  public constructor() {
    effect(() => {
      const update = this.tradingState.tradeUpdated.value();
      if (update === undefined) {
        return;
      }
      const trade = update.trade;
      const seat = this.lobbyState.selfSeat();
      const isNewTrade = trade.id !== this.lastSeenTradeId;
      const statusChanged = trade.status !== this.lastSeenTradeStatus;
      this.lastSeenTradeId = trade.id;
      this.lastSeenTradeStatus = trade.status;
      if (!isNewTrade && !statusChanged) {
        return;
      }
      if (
        trade.status === TradeStatus.Open &&
        seat !== null &&
        (trade.toSeat === seat || trade.fromSeat === seat)
      ) {
        this.tradeOpen.set(true);
        return;
      }
      if (trade.status !== TradeStatus.Open) {
        this.tradeOpen.set(false);
      }
    });
  }

  public resetForSpectatorMode(): void {
    this.tradeOpen.set(false);
  }

  public openTrade(): void {
    this.tradeOpen.set(true);
  }

  public closeTrade(): void {
    this.tradeOpen.set(false);
  }

  public onBankTrade(request: BankTradeRequest): void {
    this.tradingState.bankTrade(request.give, request.amount, request.receive);
    this.tradeOpen.set(false);
  }

  public onProposeTrade(request: ProposeTradeRequest): void {
    this.tradingState.proposeTrade(request.toSeat, request.offer, request.request);
  }

  public onAcceptTrade(tradeId: string): void {
    this.tradingState.acceptTrade(tradeId);
  }

  public onRejectTrade(tradeId: string): void {
    this.tradingState.rejectTrade(tradeId);
  }

  public finishTrading(): void {
    this.tradingState.finishTrading();
  }
}
