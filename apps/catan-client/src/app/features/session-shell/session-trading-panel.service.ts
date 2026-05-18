import { computed, effect, inject, Injectable, signal } from '@angular/core';
import {
  TradeRecipientStatus,
  TradeStatus,
  TradeUpdateKind,
  type TradeUpdatedPayload,
} from '@catan/api-interfaces';
import { LobbyGameUiStateService } from '../lobby-game-ui/lobby-game-ui-state.service';
import { LobbyTradeUiService } from '../lobby-game-ui/lobby-trade-ui.service';
import { TradingStateService } from '../trading/trading-state.service';
import {
  TradePendingActionKind,
  type BankTradeRequest,
  type CounterTradeRequest,
  type FinalizeTradeRequest,
  type ProposeTradeRequest,
  type TradePendingAction,
} from '../trading/trading-ui.types';

/** Safety net for an inflight action whose server echo never arrived. */
const PENDING_ACTION_TIMEOUT_MS = 6_000;

/**
 * Orchestrates the trade panel for {@link SessionShell}:
 *  - tracks whether the panel is open / sticky-minimised
 *  - relays outgoing trade actions to {@link TradingStateService}
 *  - reacts to inbound {@link TradeUpdatedPayload}s with the right open/close
 *    behaviour driven by {@link TradeUpdateKind}, so the user gets a
 *    predictable popup model without losing their place when they manually
 *    minimise.
 */
@Injectable()
export class SessionTradingPanelService {
  private readonly tradingState = inject(TradingStateService);
  private readonly lobbyState = inject(LobbyGameUiStateService);
  private readonly tradeUi = inject(LobbyTradeUiService);

  public readonly tradeOpen = signal<boolean>(false);

  /**
   * Trade id the user explicitly minimised. Subsequent status updates on this
   * trade do NOT auto-reopen — the user can re-open via the HUD toggle. Cleared
   * when the trade id rotates (new propose) or the trade reaches a terminal
   * state.
   */
  private readonly userMinimizedTradeId = signal<string | null>(null);

  private readonly pendingActionSignal = signal<TradePendingAction | null>(null);
  public readonly pendingAction = this.pendingActionSignal.asReadonly();

  /** Number of recipient slots on my own open trade that have responded but not been finalised yet. */
  public readonly unseenResponseCount = computed<number>(() => {
    const trade = this.tradeUi.pendingTrade();
    const seat = this.lobbyState.selfSeat();
    if (trade === null || seat === null || trade.fromSeat !== seat) {
      return 0;
    }
    let count = 0;
    for (let i = 0; i < trade.recipients.length; i += 1) {
      const status = trade.recipients[i].status;
      if (
        status === TradeRecipientStatus.Accepted ||
        status === TradeRecipientStatus.Countered
      ) {
        count += 1;
      }
    }
    return count;
  });

  /** True when a trade involving self is open but the panel is currently minimised. */
  public readonly hasMinimisedIncoming = computed<boolean>(() => {
    if (this.tradeOpen()) {
      return false;
    }
    return this.tradeUi.selfHasOpenTrade();
  });

  private lastSeenTradeId: string | null = null;
  private pendingActionTimer: ReturnType<typeof setTimeout> | null = null;

  public constructor() {
    effect(() => {
      const update = this.tradingState.tradeUpdated.value();
      if (update === undefined) {
        return;
      }
      this.onTradeUpdated(update);
    });
  }

  public resetForSpectatorMode(): void {
    this.tradeOpen.set(false);
    this.userMinimizedTradeId.set(null);
    this.clearPendingAction();
  }

  /**
   * Wipe everything that's lobby-scoped — the transition tracker also has to
   * forget the previous lobby's last trade so a brand-new trade in the next
   * lobby isn't mis-classified as a stale repeat.
   */
  public resetForLobbyLeave(): void {
    this.tradeOpen.set(false);
    this.userMinimizedTradeId.set(null);
    this.lastSeenTradeId = null;
    this.clearPendingAction();
  }

  public openTrade(): void {
    this.userMinimizedTradeId.set(null);
    this.tradeOpen.set(true);
  }

  public closeTrade(): void {
    this.minimiseCurrentTrade();
  }

  /** Toggle the panel from the HUD Trade button. Clears sticky on re-open. */
  public toggleTrade(): void {
    if (this.tradeOpen()) {
      this.minimiseCurrentTrade();
      return;
    }
    this.openTrade();
  }

  public onBankTrade(request: BankTradeRequest): void {
    this.markPending({ kind: TradePendingActionKind.Bank, tradeId: null });
    this.tradingState.bankTrade(request.give, request.amount, request.receive);
    this.tradeOpen.set(false);
  }

  public onProposeTrade(request: ProposeTradeRequest): void {
    this.markPending({ kind: TradePendingActionKind.Propose, tradeId: null });
    this.tradingState.proposeTrade(request.recipients, request.offer, request.request);
  }

  public onAcceptTrade(tradeId: string): void {
    this.markPending({ kind: TradePendingActionKind.Accept, tradeId });
    this.tradingState.acceptTrade(tradeId);
  }

  public onRejectTrade(tradeId: string): void {
    this.markPending({ kind: TradePendingActionKind.Reject, tradeId });
    this.tradingState.rejectTrade(tradeId);
  }

  public onCounterTrade(request: CounterTradeRequest): void {
    this.markPending({ kind: TradePendingActionKind.Counter, tradeId: request.tradeId });
    this.tradingState.counterTrade(request.tradeId, request.offer, request.request);
  }

  public onWithdrawCounter(tradeId: string): void {
    this.markPending({ kind: TradePendingActionKind.WithdrawCounter, tradeId });
    this.tradingState.withdrawCounterTrade(tradeId);
  }

  public onFinalizeTrade(request: FinalizeTradeRequest): void {
    this.markPending({ kind: TradePendingActionKind.Finalize, tradeId: request.tradeId });
    this.tradingState.finalizeTrade(request.tradeId, request.recipientSeat);
  }

  public finishTrading(): void {
    this.tradingState.finishTrading();
  }

  private onTradeUpdated(update: TradeUpdatedPayload): void {
    const trade = update.trade;
    const seat = this.lobbyState.selfSeat();
    const involvesSelf =
      seat !== null &&
      (trade.fromSeat === seat || trade.recipients.some((r) => r.seat === seat));

    this.resolvePendingAction(update);

    // Drop sticky minimise when this *isn't* the trade the user minimised.
    if (
      this.userMinimizedTradeId() !== null &&
      this.userMinimizedTradeId() !== trade.id
    ) {
      this.userMinimizedTradeId.set(null);
    }

    if (trade.id !== this.lastSeenTradeId) {
      this.lastSeenTradeId = trade.id;
    }

    switch (update.kind) {
      case TradeUpdateKind.Superseded:
        // Server-internal: collision with a new propose; the replacement Open
        // event arrives right after — don't flicker.
        return;
      case TradeUpdateKind.Created:
        if (involvesSelf) {
          // A brand-new offer always re-opens — sticky was scoped to the
          // previous trade id and has already been cleared above.
          this.userMinimizedTradeId.set(null);
          this.tradeOpen.set(true);
        }
        return;
      case TradeUpdateKind.RecipientAccepted:
      case TradeUpdateKind.RecipientCountered:
        if (involvesSelf && this.userMinimizedTradeId() !== trade.id) {
          // Sender sees a response come in — open panel so they can finalise.
          // Recipient sees their own action confirmed — already open in nearly
          // every case; this is a no-op if it was open.
          this.tradeOpen.set(true);
        }
        return;
      case TradeUpdateKind.RecipientCounterWithdrawn:
      case TradeUpdateKind.RecipientRejected:
        // Don't disturb the user's current focus for these.
        return;
      case TradeUpdateKind.Cancelled:
        if (seat !== null && trade.fromSeat === seat) {
          // Sender withdrew their own offer — keep the panel open so they drop
          // straight back into the composer instead of having to reopen it.
          this.userMinimizedTradeId.set(null);
          return;
        }
        if (involvesSelf) {
          this.tradeOpen.set(false);
          this.userMinimizedTradeId.set(null);
        }
        return;
      case TradeUpdateKind.Finalized:
      case TradeUpdateKind.PhaseClosed:
        if (involvesSelf) {
          this.tradeOpen.set(false);
          this.userMinimizedTradeId.set(null);
        }
        return;
      case TradeUpdateKind.Resync:
        if (involvesSelf) {
          // Reconnect/join landed us back in an in-flight thread; surface it
          // immediately so the user doesn't have to hunt for the HUD button.
          this.userMinimizedTradeId.set(null);
          this.tradeOpen.set(true);
        }
        return;
    }

    // Defensive: terminal status without a recognised kind closes the panel.
    if (trade.status !== TradeStatus.Open && involvesSelf) {
      this.tradeOpen.set(false);
      this.userMinimizedTradeId.set(null);
    }
  }

  private minimiseCurrentTrade(): void {
    const current = this.tradeUi.pendingTrade();
    this.userMinimizedTradeId.set(current?.id ?? null);
    this.tradeOpen.set(false);
  }

  private markPending(
    pending: { readonly kind: TradePendingActionKind; readonly tradeId: string | null },
  ): void {
    this.clearPendingActionTimer();
    this.pendingActionSignal.set({
      kind: pending.kind,
      tradeId: pending.tradeId,
      startedAtMs: Date.now(),
    });
    this.pendingActionTimer = setTimeout(() => {
      this.pendingActionSignal.set(null);
      this.pendingActionTimer = null;
    }, PENDING_ACTION_TIMEOUT_MS);
  }

  private resolvePendingAction(update: TradeUpdatedPayload): void {
    const pending = this.pendingActionSignal();
    if (pending === null) {
      return;
    }
    const seat = this.lobbyState.selfSeat();
    const wasMyAction =
      seat !== null && update.actorSeat === seat && this.kindMatches(pending.kind, update.kind);
    if (!wasMyAction) {
      return;
    }
    // For Propose / Bank we don't know the trade id beforehand; matching on
    // (actor=self ∧ kind=Created) is good enough — the server only fires
    // Created in response to a propose.
    if (
      pending.tradeId !== null &&
      pending.tradeId !== update.trade.id &&
      pending.kind !== TradePendingActionKind.Propose
    ) {
      return;
    }
    this.clearPendingAction();
  }

  private kindMatches(pending: TradePendingActionKind, kind: TradeUpdateKind): boolean {
    switch (pending) {
      case TradePendingActionKind.Propose:
        return kind === TradeUpdateKind.Created;
      case TradePendingActionKind.Accept:
        return kind === TradeUpdateKind.RecipientAccepted;
      case TradePendingActionKind.Counter:
        return kind === TradeUpdateKind.RecipientCountered;
      case TradePendingActionKind.WithdrawCounter:
        return kind === TradeUpdateKind.RecipientCounterWithdrawn;
      case TradePendingActionKind.Reject:
        return kind === TradeUpdateKind.RecipientRejected || kind === TradeUpdateKind.Cancelled;
      case TradePendingActionKind.Finalize:
        return kind === TradeUpdateKind.Finalized;
      case TradePendingActionKind.Bank:
        // BankTrade currently doesn't emit a TradeUpdated; rely on timeout.
        return false;
    }
  }

  private clearPendingAction(): void {
    this.clearPendingActionTimer();
    this.pendingActionSignal.set(null);
  }

  private clearPendingActionTimer(): void {
    if (this.pendingActionTimer !== null) {
      clearTimeout(this.pendingActionTimer);
      this.pendingActionTimer = null;
    }
  }
}
