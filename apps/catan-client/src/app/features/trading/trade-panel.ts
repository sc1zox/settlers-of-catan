import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  PlayerHarborRatesDto,
  PlayerSeat,
  ResourceType,
  TradeRecipientStatus,
  type TradeOfferDto,
  type TradeRecipientResponse,
} from '@catan/api-interfaces';
import { TranslateInstantFn } from '../../../shared/i18n/translate-instant-fn';
import {
  TradeComposerView,
  TradePanelMode,
  TradePendingActionKind,
  TradeResourceSide,
  type BankTradeRequest,
  type CounterTradeRequest,
  type FinalizeTradeRequest,
  type ProposeTradeRequest,
  type TradePartner,
  type TradePendingAction,
} from './trading-ui.types';
import { RESOURCE_TYPE_ORDER, resourceTypeLabel } from '../../../shared/i18n/resource-labels';

const DEFAULT_HARBOR_RATES: PlayerHarborRatesDto = {
  generic: 4,
  perResource: {
    [ResourceType.Wood]: 4,
    [ResourceType.Brick]: 4,
    [ResourceType.Wheat]: 4,
    [ResourceType.Wool]: 4,
    [ResourceType.Ore]: 4,
  },
};

@Component({
  selector: 'app-trade-panel',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trade-panel.html',
  styleUrl: './trade-panel.scss',
})
export class TradePanel {
  private readonly translate = inject(TranslateService);
  private readonly instant: TranslateInstantFn = (key, params) =>
    this.translate.instant(marker(key), params);

  readonly open = input<boolean>(false);
  readonly selfSeat = input<PlayerSeat | null>(null);
  readonly selfResources = input<Readonly<Record<ResourceType, number>>>(this.zeroCounts());
  readonly selfHarborRates = input<PlayerHarborRatesDto>(DEFAULT_HARBOR_RATES);
  readonly partnerList = input<readonly TradePartner[]>([]);
  readonly pendingTrade = input<TradeOfferDto | null>(null);
  /**
   * The trade action the user just dispatched and is waiting for the server to
   * echo. Drives the per-button spinner / disabled state so the user gets
   * immediate visual feedback instead of staring at an unchanged panel.
   */
  readonly pendingAction = input<TradePendingAction | null>(null);

  readonly bankTrade = output<BankTradeRequest>();
  readonly propose = output<ProposeTradeRequest>();
  readonly counter = output<CounterTradeRequest>();
  readonly withdrawCounter = output<string>();
  readonly accept = output<string>();
  readonly reject = output<string>();
  readonly finalize = output<FinalizeTradeRequest>();
  readonly closed = output<void>();

  protected readonly order = RESOURCE_TYPE_ORDER;
  protected readonly recipientStatusEnum = TradeRecipientStatus;
  protected readonly modeEnum = TradePanelMode;
  protected readonly viewEnum = TradeComposerView;
  protected readonly pendingKindEnum = TradePendingActionKind;
  protected readonly sideOffer = TradeResourceSide.Offer;
  protected readonly sideRequest = TradeResourceSide.Request;
  protected readonly partners = computed<readonly TradePartner[]>(() => this.partnerList());

  /** Composer↔counter toggle (only set true while a trade is open and self is a recipient). */
  private readonly counterRequested = linkedSignal<string, boolean>({
    source: () => `${this.open() ? '1' : '0'}|${this.pendingTrade()?.id ?? ''}`,
    computation: () => false,
  });

  protected readonly mode = computed<TradePanelMode>(() => {
    const trade = this.pendingTrade();
    const seat = this.selfSeat();
    if (trade !== null && seat !== null) {
      if (trade.fromSeat === seat) {
        return TradePanelMode.Sender;
      }
      if (this.isRecipient(trade, seat)) {
        return this.counterRequested() ? TradePanelMode.Counter : TradePanelMode.Recipient;
      }
    }
    return TradePanelMode.Composer;
  });

  /** User-chosen composer tab; never auto-resets so a withdraw drops back into the same tab. */
  protected readonly view = signal<TradeComposerView>(TradeComposerView.Bank);

  protected readonly bankGive = signal<ResourceType>(ResourceType.Wood);
  protected readonly bankReceive = signal<ResourceType>(ResourceType.Brick);

  /** Fix harbor/bank rate for the currently selected give resource (4:1, 3:1, or 2:1). */
  protected readonly bankRate = computed<number>(
    () => this.selfHarborRates().perResource[this.bankGive()] ?? 4,
  );

  protected readonly broadcastMode = signal<boolean>(true);

  protected readonly targetSeat = linkedSignal<readonly TradePartner[], PlayerSeat | null>({
    source: () => this.partnerList(),
    computation: (partners) => partners[0]?.seat ?? null,
  });

  protected readonly offer = linkedSignal<string, Record<ResourceType, number>>({
    source: () => `${this.mode()}|${this.pendingTrade()?.id ?? ''}`,
    computation: () => {
      if (this.mode() === TradePanelMode.Counter) {
        const trade = this.pendingTrade();
        if (trade !== null) {
          // Recipient perspective: prefill "Du gibst" with what the sender
          // originally requested from me — clamped to what I own.
          return this.fromMap(trade.request);
        }
      }
      return this.zeroCounts();
    },
  });

  protected readonly request = linkedSignal<string, Record<ResourceType, number>>({
    source: () => `${this.mode()}|${this.pendingTrade()?.id ?? ''}`,
    computation: () => {
      if (this.mode() === TradePanelMode.Counter) {
        const trade = this.pendingTrade();
        if (trade !== null) {
          // Recipient perspective: prefill "Du erhältst" with what the sender
          // originally offered.
          return this.fromMap(trade.offer);
        }
      }
      return this.zeroCounts();
    },
  });

  protected readonly canAcceptIncoming = computed<boolean>(() => {
    const trade = this.pendingTrade();
    if (trade === null) {
      return false;
    }
    return this.canPay(trade.request);
  });

  protected readonly canSubmitPropose = computed<boolean>(() => {
    if (this.broadcastMode()) {
      if (this.partnerList().length === 0) {
        return false;
      }
    } else if (this.targetSeat() === null) {
      return false;
    }
    return this.hasAnyMovementInComposer();
  });

  protected readonly canSubmitCounter = computed<boolean>(() => this.hasAnyMovementInComposer());

  protected readonly canSubmitBank = computed<boolean>(() => {
    if (this.bankGive() === this.bankReceive()) {
      return false;
    }
    return this.ownedFor(this.bankGive()) >= this.bankRate();
  });

  protected headerLabel(): string {
    switch (this.mode()) {
      case TradePanelMode.Sender:
        return this.instant(marker('trade.senderHeader'));
      case TradePanelMode.Recipient:
        return this.instant(marker('trade.incomingHeader'));
      case TradePanelMode.Counter:
        return this.instant(marker('trade.counterHeader'));
      default:
        return this.instant(marker('trade.title'));
    }
  }

  protected statusLabel(status: TradeRecipientStatus): string {
    switch (status) {
      case TradeRecipientStatus.Pending:
        return this.instant(marker('trade.statusPending'));
      case TradeRecipientStatus.Accepted:
        return this.instant(marker('trade.statusAccepted'));
      case TradeRecipientStatus.Countered:
        return this.instant(marker('trade.statusCountered'));
      case TradeRecipientStatus.Rejected:
        return this.instant(marker('trade.statusRejected'));
    }
  }

  protected label(resource: ResourceType): string {
    return resourceTypeLabel(this.instant, resource);
  }

  protected partnerName(seat: PlayerSeat | null): string {
    if (seat === null) {
      return '';
    }
    const partners = this.partnerList();
    for (let i = 0; i < partners.length; i += 1) {
      if (partners[i].seat === seat) {
        return partners[i].name;
      }
    }
    return '';
  }

  protected ownedFor(resource: ResourceType): number {
    return this.selfResources()[resource] ?? 0;
  }

  protected ratesFor(resource: ResourceType): number {
    return this.selfHarborRates().perResource[resource] ?? 4;
  }

  protected readMap(
    map: Readonly<Partial<Record<ResourceType, number>>>,
    resource: ResourceType,
  ): number {
    return map[resource] ?? 0;
  }

  protected isMapEmpty(map: Readonly<Partial<Record<ResourceType, number>>>): boolean {
    const keys = Object.keys(map) as ResourceType[];
    for (let i = 0; i < keys.length; i += 1) {
      if ((map[keys[i]] ?? 0) > 0) {
        return false;
      }
    }
    return true;
  }

  protected recipientSlot(trade: TradeOfferDto): TradeRecipientResponse | null {
    const seat = this.selfSeat();
    if (seat === null) {
      return null;
    }
    for (let i = 0; i < trade.recipients.length; i += 1) {
      if (trade.recipients[i].seat === seat) {
        return trade.recipients[i];
      }
    }
    return null;
  }

  protected otherRecipients(trade: TradeOfferDto): readonly TradeRecipientResponse[] {
    const seat = this.selfSeat();
    return trade.recipients.filter((r) => r.seat !== seat);
  }

  protected canFinalizeWith(slot: TradeRecipientResponse): boolean {
    const trade = this.pendingTrade();
    if (trade === null) {
      return false;
    }
    if (slot.status === TradeRecipientStatus.Accepted) {
      // sender must own offer.offer, recipient must own offer.request — sender
      // can only check own side; recipient side server-validated.
      return this.canPay(trade.offer);
    }
    if (slot.status === TradeRecipientStatus.Countered && slot.counter !== undefined) {
      return this.canPay(slot.counter.offer);
    }
    return false;
  }

  protected setBroadcastMode(value: boolean): void {
    this.broadcastMode.set(value);
  }

  protected adjust(side: TradeResourceSide, resource: ResourceType, delta: number): void {
    const target = side === TradeResourceSide.Offer ? this.offer : this.request;
    const counts = { ...target() };
    const next = Math.max(0, counts[resource] + delta);
    if (side === TradeResourceSide.Offer && next > this.ownedFor(resource)) {
      return;
    }
    counts[resource] = next;
    target.set(counts);
  }

  protected enterCounterMode(): void {
    this.counterRequested.set(true);
  }

  protected exitCounterMode(): void {
    this.counterRequested.set(false);
  }

  protected emitPropose(): void {
    const recipients = this.broadcastMode()
      ? this.partnerList().map((p) => p.seat)
      : (() => {
          const seat = this.targetSeat();
          return seat === null ? [] : [seat];
        })();
    if (recipients.length === 0) {
      return;
    }
    this.propose.emit({
      recipients,
      offer: this.compactTradeMap(this.offer()),
      request: this.compactTradeMap(this.request()),
    });
  }

  protected emitCounter(): void {
    const trade = this.pendingTrade();
    if (trade === null) {
      return;
    }
    // Panel uses recipient perspective; server stores sender perspective.
    // Recipient's "I give" (offer) = sender's "I receive" (request);
    // Recipient's "I receive" (request) = sender's "I give" (offer).
    this.counter.emit({
      tradeId: trade.id,
      offer: this.compactTradeMap(this.request()),
      request: this.compactTradeMap(this.offer()),
    });
  }

  protected emitWithdrawCounter(): void {
    const trade = this.pendingTrade();
    if (trade === null) {
      return;
    }
    this.withdrawCounter.emit(trade.id);
  }

  /** True iff the pending action matches this button (ignores trade id for Propose). */
  protected isPendingKind(kind: TradePendingActionKind, tradeId?: string | null): boolean {
    const pending = this.pendingAction();
    if (pending === null || pending.kind !== kind) {
      return false;
    }
    if (kind === TradePendingActionKind.Propose || kind === TradePendingActionKind.Bank) {
      return true;
    }
    return pending.tradeId === (tradeId ?? null);
  }

  /** True iff *any* inflight action exists — disables sibling buttons while one is pending. */
  protected hasAnyPending(): boolean {
    return this.pendingAction() !== null;
  }

  /** Stable key per slot that flips on status change so @for re-renders the element (CSS pulse restarts). */
  protected slotKey(resp: TradeRecipientResponse): string {
    return `${resp.seat}|${resp.status}`;
  }

  private hasAnyMovementInComposer(): boolean {
    const offer = this.offer();
    const request = this.request();
    const owned = this.selfResources();
    let anyOffer = 0;
    let anyRequest = 0;
    for (let i = 0; i < this.order.length; i += 1) {
      const r = this.order[i];
      if (offer[r] > (owned[r] ?? 0)) {
        return false;
      }
      anyOffer += offer[r];
      anyRequest += request[r];
    }
    return anyOffer + anyRequest > 0;
  }

  private canPay(cost: Readonly<Partial<Record<ResourceType, number>>>): boolean {
    const owned = this.selfResources();
    const keys = Object.keys(cost) as ResourceType[];
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const need = cost[key] ?? 0;
      if ((owned[key] ?? 0) < need) {
        return false;
      }
    }
    return true;
  }

  private isRecipient(trade: TradeOfferDto, seat: PlayerSeat): boolean {
    for (let i = 0; i < trade.recipients.length; i += 1) {
      if (trade.recipients[i].seat === seat) {
        return true;
      }
    }
    return false;
  }

  private fromMap(map: Readonly<Partial<Record<ResourceType, number>>>): Record<ResourceType, number> {
    const owned = this.selfResources();
    const out = this.zeroCounts();
    for (let i = 0; i < this.order.length; i += 1) {
      const r = this.order[i];
      const want = map[r] ?? 0;
      out[r] = Math.min(want, owned[r] ?? 0);
    }
    return out;
  }

  private compactTradeMap(
    map: Readonly<Record<ResourceType, number>>,
  ): Partial<Record<ResourceType, number>> {
    const out: Partial<Record<ResourceType, number>> = {};
    for (let i = 0; i < this.order.length; i += 1) {
      const resource = this.order[i];
      const value = map[resource];
      if (value > 0) {
        out[resource] = value;
      }
    }
    return out;
  }

  private zeroCounts(): Record<ResourceType, number> {
    return {
      [ResourceType.Wood]: 0,
      [ResourceType.Brick]: 0,
      [ResourceType.Wheat]: 0,
      [ResourceType.Wool]: 0,
      [ResourceType.Ore]: 0,
    };
  }
}
