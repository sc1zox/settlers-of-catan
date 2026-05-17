import { effect, inject, Injectable, signal } from '@angular/core';
import { TradeStatus } from '@catan/api-interfaces';
import { LobbyGameUiStateService } from '../lobby-game-ui/lobby-game-ui-state.service';
import { TradingStateService } from '../trading/trading-state.service';
import type {
  BankTradeRequest,
  CounterTradeRequest,
  FinalizeTradeRequest,
  ProposeTradeRequest,
} from '../../shared/types/trading-ui.types';

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
      const involvesSelf =
        seat !== null &&
        (trade.fromSeat === seat || trade.recipients.some((r) => r.seat === seat));
      if (trade.status === TradeStatus.Open && involvesSelf) {
        // Always auto-open when a new open offer involves us — receivers get
        // the popup immediately, senders get the waiting view.
        this.tradeOpen.set(true);
        return;
      }
      if (trade.status === TradeStatus.Superseded) {
        // Server-internal: collision with a new propose. A fresh Open event
        // for the replacement trade arrives right after — don't flicker.
        return;
      }
      if (
        trade.status === TradeStatus.Cancelled &&
        seat !== null &&
        trade.fromSeat === seat
      ) {
        // Sender withdrew their own offer — keep the panel open so they drop
        // straight back into the composer instead of having to reopen it.
        return;
      }
      if (trade.status !== TradeStatus.Open && involvesSelf) {
        // User-facing terminal (Accepted / Rejected / Cancelled by other) —
        // close the panel so it doesn't linger on a stale view.
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

  /** Toggle the panel from the HUD Trade button. */
  public toggleTrade(): void {
    this.tradeOpen.update((current) => !current);
  }

  public onBankTrade(request: BankTradeRequest): void {
    this.tradingState.bankTrade(request.give, request.amount, request.receive);
    this.tradeOpen.set(false);
  }

  public onProposeTrade(request: ProposeTradeRequest): void {
    this.tradingState.proposeTrade(request.recipients, request.offer, request.request);
  }

  public onAcceptTrade(tradeId: string): void {
    this.tradingState.acceptTrade(tradeId);
  }

  public onRejectTrade(tradeId: string): void {
    this.tradingState.rejectTrade(tradeId);
  }

  public onCounterTrade(request: CounterTradeRequest): void {
    this.tradingState.counterTrade(request.tradeId, request.offer, request.request);
  }

  public onFinalizeTrade(request: FinalizeTradeRequest): void {
    this.tradingState.finalizeTrade(request.tradeId, request.recipientSeat);
  }

  public finishTrading(): void {
    this.tradingState.finishTrading();
  }
}
