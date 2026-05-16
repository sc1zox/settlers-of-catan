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
import { PlayerSeat, ResourceType, type TradeOfferDto } from '@catan/api-interfaces';
import { TranslateInstantFn } from '../../../shared/i18n/translate-instant-fn';
import type {
  BankTradeRequest,
  ProposeTradeRequest,
  TradePartner,
} from '../../shared/types/trading-ui.types';
import { RESOURCE_TYPE_ORDER, resourceTypeLabel } from '../../shared/resource-labels';

type TradeView = 'bank' | 'player';

@Component({
  selector: 'app-trade-panel',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="layer">
        <button
          type="button"
          class="backdrop"
          [attr.aria-label]="'trade.closeBackdropAria' | translate"
          (click)="closed.emit()"
        ></button>
        <div class="modal">
          <header>
            <h3>{{ 'trade.title' | translate }}</h3>
            <div class="tabs">
              <button type="button" [class.active]="view() === 'bank'" (click)="view.set('bank')">
                {{ 'trade.tabBank' | translate }}
              </button>
              <button
                type="button"
                [class.active]="view() === 'player'"
                (click)="view.set('player')"
              >
                {{ 'trade.tabPlayers' | translate }}
              </button>
            </div>
          </header>

          @let incoming = pendingTrade();
          @if (incoming && incoming.toSeat === selfSeat()) {
            <div class="incoming">
              <p>{{ 'trade.incomingTitle' | translate }}</p>
              <div class="incoming-actions">
                <button type="button" class="accept" (click)="accept.emit(incoming.id)">
                  {{ 'trade.accept' | translate }}
                </button>
                <button type="button" class="reject" (click)="reject.emit(incoming.id)">
                  {{ 'trade.reject' | translate }}
                </button>
              </div>
            </div>
          }

          @switch (view()) {
            @case ('bank') {
              <div class="bank">
                <div class="field">
                  <span>{{ 'trade.give' | translate }}</span>
                  <div class="picker">
                    @for (resource of order; track resource) {
                      <button
                        type="button"
                        [class.active]="bankGive() === resource"
                        (click)="bankGive.set(resource)"
                      >
                        {{ label(resource) }}
                      </button>
                    }
                  </div>
                </div>
                <div class="field">
                  <span>{{ 'trade.amount' | translate }}</span>
                  <div class="stepper">
                    <button type="button" (click)="bankAmount.set(max(2, bankAmount() - 1))">
                      −
                    </button>
                    <span class="count">{{ bankAmount() }}</span>
                    <button type="button" (click)="bankAmount.set(bankAmount() + 1)">+</button>
                  </div>
                </div>
                <div class="field">
                  <span>{{ 'trade.take' | translate }}</span>
                  <div class="picker">
                    @for (resource of order; track resource) {
                      <button
                        type="button"
                        [class.active]="bankReceive() === resource"
                        (click)="bankReceive.set(resource)"
                      >
                        {{ label(resource) }}
                      </button>
                    }
                  </div>
                </div>
                <button
                  type="button"
                  class="confirm"
                  [disabled]="bankGive() === bankReceive()"
                  (click)="
                    bankTrade.emit({
                      give: bankGive(),
                      amount: bankAmount(),
                      receive: bankReceive(),
                    })
                  "
                >
                  {{ 'trade.bankExecute' | translate }}
                </button>
              </div>
            }
            @case ('player') {
              <div class="player">
                <div class="field">
                  <span>{{ 'trade.to' | translate }}</span>
                  <div class="picker">
                    @for (partner of partners(); track partner.seat) {
                      <button
                        type="button"
                        [class.active]="targetSeat() === partner.seat"
                        (click)="targetSeat.set(partner.seat)"
                      >
                        {{ partner.name }}
                      </button>
                    }
                  </div>
                </div>
                <div class="trade-grid">
                  <div class="col">
                    <p>{{ 'trade.youGive' | translate }}</p>
                    @for (resource of order; track resource) {
                      <div class="grid-row">
                        <span class="label">{{ label(resource) }}</span>
                        <div class="stepper">
                          <button type="button" (click)="adjust('offer', resource, -1)">−</button>
                          <span class="count">{{ offer()[resource] }}</span>
                          <button type="button" (click)="adjust('offer', resource, 1)">+</button>
                        </div>
                      </div>
                    }
                  </div>
                  <div class="col">
                    <p>{{ 'trade.youWant' | translate }}</p>
                    @for (resource of order; track resource) {
                      <div class="grid-row">
                        <span class="label">{{ label(resource) }}</span>
                        <div class="stepper">
                          <button type="button" (click)="adjust('request', resource, -1)">−</button>
                          <span class="count">{{ request()[resource] }}</span>
                          <button type="button" (click)="adjust('request', resource, 1)">+</button>
                        </div>
                      </div>
                    }
                  </div>
                </div>
                <button
                  type="button"
                  class="confirm"
                  [disabled]="targetSeat() === null"
                  (click)="emitPropose()"
                >
                  {{ 'trade.sendOffer' | translate }}
                </button>
              </div>
            }
          }

          <button type="button" class="dismiss" (click)="closed.emit()">
            {{ 'trade.dismiss' | translate }}
          </button>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 30;
      }
      .layer {
        position: absolute;
        inset: 0;
        pointer-events: auto;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .backdrop {
        position: absolute;
        inset: 0;
        border: 0;
        padding: 0;
        cursor: default;
        background: rgba(8, 6, 10, 0.62);
        backdrop-filter: blur(2px);
      }
      .modal {
        position: relative;
        width: min(94vw, 32rem);
        max-height: 88vh;
        overflow-y: auto;
        background: rgba(20, 16, 12, 0.97);
        border: 1px solid rgba(255, 200, 130, 0.5);
        border-radius: 16px;
        padding: 1.2rem 1.3rem 1.2rem;
        color: #f7f1e1;
        box-shadow: 0 22px 70px rgba(0, 0, 0, 0.6);
      }
      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.8rem;
        margin-bottom: 0.9rem;
      }
      h3 {
        margin: 0;
        font-size: 1.05rem;
      }
      .tabs {
        display: flex;
        gap: 0.35rem;
      }
      .incoming {
        background: rgba(120, 200, 140, 0.12);
        border: 1px solid rgba(120, 200, 140, 0.4);
        border-radius: 10px;
        padding: 0.55rem 0.7rem;
        margin-bottom: 0.9rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.6rem;
      }
      .incoming p {
        margin: 0;
        font-size: 0.82rem;
      }
      .incoming-actions {
        display: flex;
        gap: 0.4rem;
      }
      .field {
        margin-bottom: 0.7rem;
      }
      .field > span {
        display: block;
        font-size: 0.74rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgba(247, 241, 225, 0.55);
        margin-bottom: 0.3rem;
      }
      .picker {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
      }
      .trade-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.8rem;
        margin: 0.4rem 0 0.8rem;
      }
      .col p {
        margin: 0 0 0.4rem;
        font-size: 0.8rem;
        font-weight: 600;
      }
      .grid-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.4rem;
        margin-bottom: 0.32rem;
      }
      .grid-row .label {
        font-size: 0.78rem;
      }
      .stepper {
        display: flex;
        align-items: center;
        gap: 0.35rem;
      }
      .stepper button {
        width: 1.6rem;
        height: 1.6rem;
        padding: 0;
        font-size: 0.95rem;
        line-height: 1;
      }
      .count {
        min-width: 1.1rem;
        text-align: center;
        font-weight: 600;
      }
      button {
        appearance: none;
        cursor: pointer;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        background: rgba(255, 255, 255, 0.08);
        color: #f7f1e1;
        font-size: 0.8rem;
        font-weight: 600;
        padding: 0.32rem 0.7rem;
      }
      button.active,
      .tabs button.active {
        background: linear-gradient(180deg, #4f8be0, #3563b4);
        border-color: transparent;
        color: #fff;
      }
      .accept {
        background: linear-gradient(180deg, #5cc27a, #3a9457);
        border-color: transparent;
        color: #fff;
      }
      .reject {
        background: rgba(220, 90, 80, 0.85);
        border-color: transparent;
        color: #fff;
      }
      .confirm {
        width: 100%;
        background: linear-gradient(180deg, #4f8be0, #3563b4);
        border-color: transparent;
        color: #fff;
        padding: 0.55rem;
        margin-bottom: 0.5rem;
      }
      .confirm:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .dismiss {
        width: 100%;
        background: transparent;
        border-color: rgba(255, 255, 255, 0.18);
      }
    `,
  ],
})
export class TradePanelComponent {
  private readonly translate = inject(TranslateService);
  private readonly instant: TranslateInstantFn = (key, params) =>
    this.translate.instant(marker(key), params);

  readonly open = input<boolean>(false);
  readonly selfSeat = input<PlayerSeat | null>(null);
  readonly partnerList = input<readonly TradePartner[]>([]);
  readonly pendingTrade = input<TradeOfferDto | null>(null);

  readonly bankTrade = output<BankTradeRequest>();
  readonly propose = output<ProposeTradeRequest>();
  readonly accept = output<string>();
  readonly reject = output<string>();
  readonly closed = output<void>();

  protected readonly order = RESOURCE_TYPE_ORDER;
  protected readonly partners = computed<readonly TradePartner[]>(() => this.partnerList());

  protected readonly view = linkedSignal<boolean, TradeView>({
    source: () => this.open(),
    computation: () => 'bank',
  });

  protected readonly bankGive = signal<ResourceType>(ResourceType.Wood);
  protected readonly bankReceive = signal<ResourceType>(ResourceType.Brick);
  protected readonly bankAmount = signal<number>(4);

  protected readonly targetSeat = linkedSignal<boolean, PlayerSeat | null>({
    source: () => this.open(),
    computation: () => this.partnerList()[0]?.seat ?? null,
  });
  protected readonly offer = linkedSignal<boolean, Record<ResourceType, number>>({
    source: () => this.open(),
    computation: () => this.zeroCounts(),
  });
  protected readonly request = linkedSignal<boolean, Record<ResourceType, number>>({
    source: () => this.open(),
    computation: () => this.zeroCounts(),
  });

  protected label(resource: ResourceType): string {
    return resourceTypeLabel(this.instant, resource);
  }

  protected max(a: number, b: number): number {
    return Math.max(a, b);
  }

  protected adjust(side: 'offer' | 'request', resource: ResourceType, delta: number): void {
    const target = side === 'offer' ? this.offer : this.request;
    const counts = { ...target() };
    counts[resource] = Math.max(0, counts[resource] + delta);
    target.set(counts);
  }

  protected emitPropose(): void {
    const toSeat = this.targetSeat();
    if (toSeat === null) {
      return;
    }
    this.propose.emit({ toSeat, offer: this.offer(), request: this.request() });
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
