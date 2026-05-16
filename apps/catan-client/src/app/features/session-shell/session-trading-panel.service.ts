import { inject, Injectable, signal } from '@angular/core';
import { TradingStateService } from '../trading/trading-state.service';
import type { BankTradeRequest, ProposeTradeRequest } from '../../shared/types/trading-ui.types';

@Injectable()
export class SessionTradingPanelService {
  private readonly tradingState = inject(TradingStateService);

  public readonly tradeOpen = signal<boolean>(false);

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
    this.tradeOpen.set(false);
  }

  public onAcceptTrade(tradeId: string): void {
    this.tradingState.acceptTrade(tradeId);
    this.tradeOpen.set(false);
  }

  public onRejectTrade(tradeId: string): void {
    this.tradingState.rejectTrade(tradeId);
  }

  public finishTrading(): void {
    this.tradingState.finishTrading();
  }
}
