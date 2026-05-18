import { computed, effect, inject, Injectable, signal } from '@angular/core';
import {
  TradeRecipientStatus,
  TradeUpdateKind,
  type TradeUpdatedPayload,
} from '@catan/api-interfaces';
import { LobbyGameUiStateService } from '../lobby-game-ui/lobby-game-ui-state.service';
import { LobbyShellGameUiService } from '../lobby-game-ui/lobby-shell-game-ui.service';
import { canPayResourceMap } from '../trading/trading-can-pay.util';
import { TradeSessionService } from '../trading/trade-session.service';
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
 *  - relays outgoing trade actions to {@link TradeSessionService}
 *  - reacts to inbound {@link TradeUpdatedPayload}s with the right open/close
 *    behaviour driven by {@link TradeUpdateKind}, so the user gets a
 *    predictable popup model without losing their place when they manually
 *    minimise.
 */
@Injectable()
export class SessionTradingPanelService {
  private readonly tradeSession = inject(TradeSessionService);
  private readonly lobbyState = inject(LobbyGameUiStateService);
  private readonly lobbyGameUi = inject(LobbyShellGameUiService);

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
    const trade = this.tradeSession.pendingTrade();
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
    return this.tradeSession.selfHasOpenTrade();
  });

  private pendingActionTimer: ReturnType<typeof setTimeout> | null = null;

  public constructor() {
    effect(() => {
      const update = this.tradeSession.lastTradeUpdate();
      if (update === undefined) {
        return;
      }
      this.onTradeUpdated(update);
    });
  }

  /** Wipe panel state. Called by the session cleanup coordinator. */
  public resetSession(): void {
    this.tradeOpen.set(false);
    this.userMinimizedTradeId.set(null);
    this.clearPendingAction();
  }

  /** Clear inflight button spinners without closing the panel. */
  public clearInflightAction(): void {
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
    this.tradeSession.bankTrade(request.give, request.amount, request.receive);
    this.tradeOpen.set(false);
  }

  public onProposeTrade(request: ProposeTradeRequest): void {
    if (!this.lobbyGameUi.canComposeNewTrade()) {
      return;
    }
    const self = this.lobbyState.selfPlayer();
    if (self === undefined || !canPayResourceMap(self.resources, request.offer)) {
      return;
    }
    this.markPending({ kind: TradePendingActionKind.Propose, tradeId: null });
    this.tradeSession.proposeTrade(request.recipients, request.offer, request.request);
  }

  public onAcceptTrade(tradeId: string): void {
    this.markPending({ kind: TradePendingActionKind.Accept, tradeId });
    this.tradeSession.acceptTrade(tradeId);
  }

  public onRejectTrade(tradeId: string): void {
    this.markPending({ kind: TradePendingActionKind.Reject, tradeId });
    this.tradeSession.rejectTrade(tradeId);
  }

  public onCounterTrade(request: CounterTradeRequest): void {
    const self = this.lobbyState.selfPlayer();
    if (self === undefined || !canPayResourceMap(self.resources, request.request)) {
      return;
    }
    this.markPending({ kind: TradePendingActionKind.Counter, tradeId: request.tradeId });
    this.tradeSession.counterTrade(request.tradeId, request.offer, request.request);
  }

  public onWithdrawCounter(tradeId: string): void {
    this.markPending({ kind: TradePendingActionKind.WithdrawCounter, tradeId });
    this.tradeSession.withdrawCounterTrade(tradeId);
  }

  public onFinalizeTrade(request: FinalizeTradeRequest): void {
    this.markPending({ kind: TradePendingActionKind.Finalize, tradeId: request.tradeId });
    this.tradeSession.finalizeTrade(request.tradeId, request.recipientSeat);
  }

  public finishTrading(): void {
    this.tradeSession.finishTrading();
  }

  /**
   * Panel-open contract. `currentTrade` (one per lobby) is updated by
   * {@link TradeSessionService} cache updates *before* we run, so we only
   * decide what to do with the panel surface:
   *
   *   Created / Resync          → open (new thread for this viewer)
   *   RecipientAccepted/Countered → open (sender needs to see + finalise;
   *                                       recipient already had it open)
   *   Cancelled (by self)       → keep open → drops back into Composer
   *   Cancelled / Finalized /
   *   PhaseClosed               → close (thread terminated)
   *   Superseded                → no-op (Created follows on the same socket)
   *   RecipientRejected /
   *   RecipientCounterWithdrawn → no-op (don't steal focus)
   *
   * The userMinimizedTradeId sticky bit suppresses re-opens only for the
   * specific thread the user dismissed; it's cleared whenever the thread id
   * rotates.
   */
  private onTradeUpdated(update: TradeUpdatedPayload): void {
    const trade = update.trade;
    const seat = this.lobbyState.selfSeat();
    const involvesSelf =
      seat !== null &&
      (trade.fromSeat === seat || trade.recipients.some((r) => r.seat === seat));

    this.resolvePendingAction(update);

    if (this.userMinimizedTradeId() !== trade.id) {
      this.userMinimizedTradeId.set(null);
    }

    if (!involvesSelf) {
      return;
    }

    switch (update.kind) {
      case TradeUpdateKind.Created:
      case TradeUpdateKind.Resync:
        this.tradeOpen.set(true);
        return;
      case TradeUpdateKind.RecipientAccepted:
      case TradeUpdateKind.RecipientCountered:
        if (this.userMinimizedTradeId() !== trade.id) {
          this.tradeOpen.set(true);
        }
        return;
      case TradeUpdateKind.Cancelled:
        if (trade.fromSeat === seat) {
          // Own withdraw: stay on the panel so the next compose is one tab away.
          return;
        }
        this.tradeOpen.set(false);
        return;
      case TradeUpdateKind.Finalized:
      case TradeUpdateKind.PhaseClosed:
        this.tradeOpen.set(false);
        return;
      case TradeUpdateKind.Superseded:
      case TradeUpdateKind.RecipientCounterWithdrawn:
      case TradeUpdateKind.RecipientRejected:
        return;
    }
  }

  private minimiseCurrentTrade(): void {
    const current = this.tradeSession.pendingTrade();
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
