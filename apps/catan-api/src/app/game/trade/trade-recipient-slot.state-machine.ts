import { ActionRejectCode, TradeRecipientStatus } from '@catan/api-interfaces';

/**
 * Per-recipient slot FSM inside a trade thread. Mirrors {@link TurnStateMachine}'s
 * single-method-per-transition style — the only way to read the next status is
 * to ask a transition method, and an illegal transition throws
 * {@link ActionRejectCode.InvalidTradeTransition}.
 *
 * Allowed transitions:
 *   Pending   → Accepted | Countered | Rejected
 *   Countered → Countered (overwrite) | Pending (withdraw) | Rejected
 *   Accepted  → terminal
 *   Rejected  → terminal
 *
 * Forbidding `Countered → Accepted` is deliberate: the recipient has to
 * withdraw their counter first, so accepting the original offer is always an
 * explicit choice rather than a misclick.
 */
export class TradeRecipientSlotMachine {
  public static accept(current: TradeRecipientStatus): TradeRecipientStatus {
    if (current === TradeRecipientStatus.Pending) {
      return TradeRecipientStatus.Accepted;
    }
    throw new Error(ActionRejectCode.InvalidTradeTransition);
  }

  public static counter(current: TradeRecipientStatus): TradeRecipientStatus {
    if (
      current === TradeRecipientStatus.Pending ||
      current === TradeRecipientStatus.Countered
    ) {
      return TradeRecipientStatus.Countered;
    }
    throw new Error(ActionRejectCode.InvalidTradeTransition);
  }

  public static withdrawCounter(current: TradeRecipientStatus): TradeRecipientStatus {
    if (current === TradeRecipientStatus.Countered) {
      return TradeRecipientStatus.Pending;
    }
    throw new Error(ActionRejectCode.InvalidTradeTransition);
  }

  public static reject(current: TradeRecipientStatus): TradeRecipientStatus {
    if (
      current === TradeRecipientStatus.Pending ||
      current === TradeRecipientStatus.Countered
    ) {
      return TradeRecipientStatus.Rejected;
    }
    throw new Error(ActionRejectCode.InvalidTradeTransition);
  }
}
