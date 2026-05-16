export enum TradeStatus {
  Open = 'open',
  Accepted = 'accepted',
  Rejected = 'rejected',
  Cancelled = 'cancelled',
  /** Server-internal: a fresh propose replaced this one — client should not flash close. */
  Superseded = 'superseded',
}
