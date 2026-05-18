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
            <h3>{{ headerLabel() }}</h3>
            @if (mode() === modeEnum.Composer) {
              <div class="tabs">
                <button type="button" [class.active]="view() === viewEnum.Bank" (click)="view.set(viewEnum.Bank)">
                  {{ 'trade.tabBank' | translate }}
                </button>
                <button
                  type="button"
                  [class.active]="view() === viewEnum.Player"
                  (click)="view.set(viewEnum.Player)"
                >
                  {{ 'trade.tabPlayers' | translate }}
                </button>
              </div>
            }
          </header>

          @switch (mode()) {
            @case (modeEnum.Sender) {
              @let trade = pendingTrade()!;
              <p class="sub-label">{{ 'trade.youOfferLabel' | translate }}</p>
              <div class="trade-summary trade-summary--banner">
                <div class="trade-summary__col">
                  <p class="trade-summary__caption">{{ 'trade.youOffer' | translate }}</p>
                  @if (isMapEmpty(trade.offer)) {
                    <p class="trade-summary__row trade-summary__row--empty">
                      {{ 'trade.nothing' | translate }}
                    </p>
                  }
                  @for (resource of order; track resource) {
                    @let c = readMap(trade.offer, resource);
                    @if (c > 0) {
                      <p class="trade-summary__row">
                        <span>{{ label(resource) }}</span>
                        <strong>{{ c }}</strong>
                      </p>
                    }
                  }
                </div>
                <div class="trade-summary__col">
                  <p class="trade-summary__caption">{{ 'trade.youAsk' | translate }}</p>
                  @if (isMapEmpty(trade.request)) {
                    <p class="trade-summary__row trade-summary__row--empty">
                      {{ 'trade.nothing' | translate }}
                    </p>
                  }
                  @for (resource of order; track resource) {
                    @let c = readMap(trade.request, resource);
                    @if (c > 0) {
                      <p class="trade-summary__row">
                        <span>{{ label(resource) }}</span>
                        <strong>{{ c }}</strong>
                      </p>
                    }
                  }
                </div>
              </div>

              <p class="sub-label">{{ 'trade.responsesLabel' | translate }}</p>
              <ul class="responses">
                @for (resp of trade.recipients; track slotKey(resp)) {
                  <li
                    class="response response--pulse"
                    [class.response--pending]="resp.status === recipientStatusEnum.Pending"
                    [class.response--accepted]="resp.status === recipientStatusEnum.Accepted"
                    [class.response--countered]="resp.status === recipientStatusEnum.Countered"
                    [class.response--rejected]="resp.status === recipientStatusEnum.Rejected"
                  >
                    <div class="response__head">
                      <span class="response__name">{{ partnerName(resp.seat) }}</span>
                      <span class="response__status">{{ statusLabel(resp.status) }}</span>
                    </div>
                    @if (
                      resp.status === recipientStatusEnum.Countered &&
                      resp.counter !== undefined
                    ) {
                      <div class="trade-summary">
                        <div class="trade-summary__col">
                          <p class="trade-summary__caption">
                            {{ 'trade.youWouldGive' | translate }}
                          </p>
                          @for (resource of order; track resource) {
                            @let c = readMap(resp.counter.offer, resource);
                            @if (c > 0) {
                              <p class="trade-summary__row">
                                <span>{{ label(resource) }}</span>
                                <strong>{{ c }}</strong>
                              </p>
                            }
                          }
                        </div>
                        <div class="trade-summary__col">
                          <p class="trade-summary__caption">
                            {{ 'trade.youWouldGet' | translate }}
                          </p>
                          @for (resource of order; track resource) {
                            @let c = readMap(resp.counter.request, resource);
                            @if (c > 0) {
                              <p class="trade-summary__row">
                                <span>{{ label(resource) }}</span>
                                <strong>{{ c }}</strong>
                              </p>
                            }
                          }
                        </div>
                      </div>
                    }
                    @if (
                      resp.status === recipientStatusEnum.Accepted ||
                      resp.status === recipientStatusEnum.Countered
                    ) {
                      <button
                        type="button"
                        class="accept response__finalize"
                        [disabled]="!canFinalizeWith(resp) || hasAnyPending()"
                        (click)="
                          finalize.emit({ tradeId: trade.id, recipientSeat: resp.seat })
                        "
                      >
                        @if (isPendingKind(pendingKindEnum.Finalize, trade.id)) {
                          <span class="spinner" aria-hidden="true"></span>
                          {{ 'trade.processing' | translate }}
                        } @else {
                          {{ 'trade.finalizeWith' | translate: { name: partnerName(resp.seat) } }}
                        }
                      </button>
                    }
                  </li>
                }
              </ul>

              <div class="composer-actions">
                <button
                  type="button"
                  class="reject"
                  [disabled]="hasAnyPending()"
                  (click)="reject.emit(trade.id)"
                >
                  @if (isPendingKind(pendingKindEnum.Reject, trade.id)) {
                    <span class="spinner" aria-hidden="true"></span>
                    {{ 'trade.processing' | translate }}
                  } @else {
                    {{ 'trade.withdrawOffer' | translate }}
                  }
                </button>
              </div>
            }

            @case (modeEnum.Recipient) {
              @let trade = pendingTrade()!;
              @let mySlot = recipientSlot(trade)!;
              <p class="sub-label">
                {{
                  'trade.incomingFrom'
                    | translate: { name: partnerName(trade.fromSeat) }
                }}
              </p>
              <div class="trade-summary trade-summary--banner">
                <div class="trade-summary__col">
                  <p class="trade-summary__caption">{{ 'trade.theyOffer' | translate }}</p>
                  @if (isMapEmpty(trade.offer)) {
                    <p class="trade-summary__row trade-summary__row--empty">
                      {{ 'trade.nothing' | translate }}
                    </p>
                  }
                  @for (resource of order; track resource) {
                    @let c = readMap(trade.offer, resource);
                    @if (c > 0) {
                      <p class="trade-summary__row">
                        <span>{{ label(resource) }}</span>
                        <strong>{{ c }}</strong>
                      </p>
                    }
                  }
                </div>
                <div class="trade-summary__col">
                  <p class="trade-summary__caption">{{ 'trade.theyAsk' | translate }}</p>
                  @if (isMapEmpty(trade.request)) {
                    <p class="trade-summary__row trade-summary__row--empty">
                      {{ 'trade.nothing' | translate }}
                    </p>
                  }
                  @for (resource of order; track resource) {
                    @let c = readMap(trade.request, resource);
                    @let owned = ownedFor(resource);
                    @if (c > 0) {
                      <p
                        class="trade-summary__row"
                        [class.trade-summary__row--lacking]="owned < c"
                      >
                        <span>{{ label(resource) }}</span>
                        <strong>{{ c }} / {{ owned }}</strong>
                      </p>
                    }
                  }
                </div>
              </div>

              <p class="sub-label">{{ 'trade.yourResponse' | translate }}</p>
              <p class="own-status own-status--{{ mySlot.status }}">
                {{ statusLabel(mySlot.status) }}
              </p>
              @if (mySlot.status === recipientStatusEnum.Countered && mySlot.counter !== undefined) {
                <div class="trade-summary">
                  <div class="trade-summary__col">
                    <p class="trade-summary__caption">{{ 'trade.youWouldGive' | translate }}</p>
                    @for (resource of order; track resource) {
                      @let c = readMap(mySlot.counter.request, resource);
                      @if (c > 0) {
                        <p class="trade-summary__row">
                          <span>{{ label(resource) }}</span>
                          <strong>{{ c }}</strong>
                        </p>
                      }
                    }
                  </div>
                  <div class="trade-summary__col">
                    <p class="trade-summary__caption">{{ 'trade.youWouldGet' | translate }}</p>
                    @for (resource of order; track resource) {
                      @let c = readMap(mySlot.counter.offer, resource);
                      @if (c > 0) {
                        <p class="trade-summary__row">
                          <span>{{ label(resource) }}</span>
                          <strong>{{ c }}</strong>
                        </p>
                      }
                    }
                  </div>
                </div>
              }
              @if (mySlot.status === recipientStatusEnum.Pending && !canAcceptIncoming()) {
                <p class="hint hint--warn">{{ 'trade.cannotAfford' | translate }}</p>
              }
              @if (mySlot.status === recipientStatusEnum.Countered) {
                <p class="hint hint--info">
                  {{
                    'trade.youCounteredHint'
                      | translate: { name: partnerName(trade.fromSeat) }
                  }}
                </p>
                <div class="incoming-actions incoming-actions--countered">
                  <button
                    type="button"
                    class="revise"
                    [disabled]="hasAnyPending()"
                    (click)="enterCounterMode()"
                  >
                    {{ 'trade.revise' | translate }}
                  </button>
                  <button
                    type="button"
                    class="reject"
                    [disabled]="hasAnyPending()"
                    (click)="emitWithdrawCounter()"
                  >
                    @if (isPendingKind(pendingKindEnum.WithdrawCounter, trade.id)) {
                      <span class="spinner" aria-hidden="true"></span>
                      {{ 'trade.processing' | translate }}
                    } @else {
                      {{ 'trade.withdrawCounter' | translate }}
                    }
                  </button>
                </div>
              } @else {
                <div class="incoming-actions">
                  <button
                    type="button"
                    class="accept"
                    [disabled]="
                      mySlot.status === recipientStatusEnum.Accepted ||
                      !canAcceptIncoming() ||
                      hasAnyPending()
                    "
                    (click)="accept.emit(trade.id)"
                  >
                    @if (isPendingKind(pendingKindEnum.Accept, trade.id)) {
                      <span class="spinner" aria-hidden="true"></span>
                      {{ 'trade.processing' | translate }}
                    } @else {
                      {{ 'trade.accept' | translate }}
                    }
                  </button>
                  <button
                    type="button"
                    class="reject"
                    [disabled]="
                      mySlot.status === recipientStatusEnum.Rejected ||
                      hasAnyPending()
                    "
                    (click)="reject.emit(trade.id)"
                  >
                    @if (isPendingKind(pendingKindEnum.Reject, trade.id)) {
                      <span class="spinner" aria-hidden="true"></span>
                      {{ 'trade.processing' | translate }}
                    } @else {
                      {{ 'trade.reject' | translate }}
                    }
                  </button>
                  <button
                    type="button"
                    class="revise"
                    [disabled]="hasAnyPending()"
                    (click)="enterCounterMode()"
                  >
                    {{ 'trade.revise' | translate }}
                  </button>
                </div>
              }

              @if (otherRecipients(trade).length > 0) {
                <p class="sub-label">{{ 'trade.otherResponses' | translate }}</p>
                <ul class="responses responses--compact">
                  @for (resp of otherRecipients(trade); track slotKey(resp)) {
                    <li
                      class="response response--compact response--pulse"
                      [class.response--pending]="resp.status === recipientStatusEnum.Pending"
                      [class.response--accepted]="resp.status === recipientStatusEnum.Accepted"
                      [class.response--countered]="resp.status === recipientStatusEnum.Countered"
                      [class.response--rejected]="resp.status === recipientStatusEnum.Rejected"
                    >
                      <div class="response__head">
                        <span class="response__name">{{ partnerName(resp.seat) }}</span>
                        <span class="response__status">{{ statusLabel(resp.status) }}</span>
                      </div>
                      @if (
                        resp.status === recipientStatusEnum.Countered &&
                        resp.counter !== undefined
                      ) {
                        <div class="trade-summary trade-summary--mini">
                          <div class="trade-summary__col">
                            <p class="trade-summary__caption">
                              {{ 'trade.senderWouldGive' | translate }}
                            </p>
                            @for (resource of order; track resource) {
                              @let c = readMap(resp.counter.offer, resource);
                              @if (c > 0) {
                                <p class="trade-summary__row">
                                  <span>{{ label(resource) }}</span>
                                  <strong>{{ c }}</strong>
                                </p>
                              }
                            }
                          </div>
                          <div class="trade-summary__col">
                            <p class="trade-summary__caption">
                              {{ 'trade.senderWouldGet' | translate }}
                            </p>
                            @for (resource of order; track resource) {
                              @let c = readMap(resp.counter.request, resource);
                              @if (c > 0) {
                                <p class="trade-summary__row">
                                  <span>{{ label(resource) }}</span>
                                  <strong>{{ c }}</strong>
                                </p>
                              }
                            }
                          </div>
                        </div>
                      }
                    </li>
                  }
                </ul>
              }
            }

            @case (modeEnum.Counter) {
              @let trade = pendingTrade()!;
              <p class="hint hint--info">
                {{ 'trade.counterHint' | translate: { name: partnerName(trade.fromSeat) } }}
              </p>
              <div class="trade-grid">
                <div class="col">
                  <p>{{ 'trade.youGive' | translate }}</p>
                  @for (resource of order; track resource) {
                    @let offerCount = offer()[resource];
                    @let owned = ownedFor(resource);
                    <div class="grid-row">
                      <span class="label"
                        >{{ label(resource) }}
                        <span class="owned" aria-hidden="true">· {{ owned }}</span>
                      </span>
                      <div class="stepper">
                        <button
                          type="button"
                          [disabled]="offerCount <= 0"
                          (click)="adjust(sideOffer, resource, -1)"
                        >
                          −
                        </button>
                        <span class="count">{{ offerCount }}</span>
                        <button
                          type="button"
                          [disabled]="offerCount >= owned"
                          (click)="adjust(sideOffer, resource, 1)"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  }
                </div>
                <div class="col">
                  <p>{{ 'trade.youWant' | translate }}</p>
                  @for (resource of order; track resource) {
                    @let requestCount = request()[resource];
                    <div class="grid-row">
                      <span class="label">{{ label(resource) }}</span>
                      <div class="stepper">
                        <button
                          type="button"
                          [disabled]="requestCount <= 0"
                          (click)="adjust(sideRequest, resource, -1)"
                        >
                          −
                        </button>
                        <span class="count">{{ requestCount }}</span>
                        <button
                          type="button"
                          (click)="adjust(sideRequest, resource, 1)"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  }
                </div>
              </div>
              @if (!canSubmitCounter()) {
                <p class="hint hint--soft">{{ 'trade.proposeHint' | translate }}</p>
              }
              <div class="composer-actions">
                <button
                  type="button"
                  class="back"
                  [disabled]="hasAnyPending()"
                  (click)="exitCounterMode()"
                >
                  {{ 'trade.cancelRevise' | translate }}
                </button>
                <button
                  type="button"
                  class="confirm"
                  [disabled]="!canSubmitCounter() || hasAnyPending()"
                  (click)="emitCounter()"
                >
                  @if (isPendingKind(pendingKindEnum.Counter, trade.id)) {
                    <span class="spinner" aria-hidden="true"></span>
                    {{ 'trade.sending' | translate }}
                  } @else {
                    {{ 'trade.sendCounter' | translate }}
                  }
                </button>
              </div>
            }

            @case (modeEnum.Composer) {
              @switch (view()) {
                @case (viewEnum.Bank) {
                  <div class="bank">
                    <div class="field">
                      <span>{{ 'trade.give' | translate }}</span>
                      <div class="picker">
                        @for (resource of order; track resource) {
                          @let rate = ratesFor(resource);
                          @let owned = ownedFor(resource);
                          <button
                            type="button"
                            [class.active]="bankGive() === resource"
                            [class.rate-best]="rate < 4"
                            [disabled]="owned < rate"
                            (click)="bankGive.set(resource)"
                          >
                            <span class="bank-pick-label">{{ label(resource) }}</span>
                            <span class="bank-pick-rate">{{ rate }}:1</span>
                            <span class="bank-pick-owned">· {{ owned }}</span>
                          </button>
                        }
                      </div>
                    </div>
                    <div class="field">
                      <span>{{ 'trade.take' | translate }}</span>
                      <div class="picker">
                        @for (resource of order; track resource) {
                          <button
                            type="button"
                            [class.active]="bankReceive() === resource"
                            [disabled]="resource === bankGive()"
                            (click)="bankReceive.set(resource)"
                          >
                            {{ label(resource) }}
                          </button>
                        }
                      </div>
                    </div>
                    <p class="bank-summary">
                      {{
                        'trade.bankSummary'
                          | translate
                            : {
                                amount: bankRate(),
                                give: label(bankGive()),
                                receive: label(bankReceive())
                              }
                      }}
                    </p>
                    <button
                      type="button"
                      class="confirm"
                      [disabled]="!canSubmitBank() || hasAnyPending()"
                      (click)="
                        bankTrade.emit({
                          give: bankGive(),
                          amount: bankRate(),
                          receive: bankReceive(),
                        })
                      "
                    >
                      @if (isPendingKind(pendingKindEnum.Bank)) {
                        <span class="spinner" aria-hidden="true"></span>
                        {{ 'trade.sending' | translate }}
                      } @else {
                        {{ 'trade.bankExecute' | translate }}
                      }
                    </button>
                  </div>
                }
                @case (viewEnum.Player) {
                  <div class="player">
                    <div class="field">
                      <span>{{ 'trade.recipients' | translate }}</span>
                      <div class="segmented" role="radiogroup">
                        <button
                          type="button"
                          role="radio"
                          [attr.aria-checked]="broadcastMode()"
                          [class.active]="broadcastMode()"
                          (click)="setBroadcastMode(true)"
                        >
                          {{ 'trade.targetBroadcast' | translate }}
                        </button>
                        <button
                          type="button"
                          role="radio"
                          [attr.aria-checked]="!broadcastMode()"
                          [class.active]="!broadcastMode()"
                          (click)="setBroadcastMode(false)"
                        >
                          {{ 'trade.targetSingle' | translate }}
                        </button>
                      </div>
                      @if (!broadcastMode()) {
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
                      } @else {
                        <p class="hint hint--soft">
                          {{
                            'trade.broadcastHint'
                              | translate: { count: partners().length }
                          }}
                        </p>
                      }
                    </div>
                    <div class="trade-grid">
                      <div class="col">
                        <p>{{ 'trade.youGive' | translate }}</p>
                        @for (resource of order; track resource) {
                          @let offerCount = offer()[resource];
                          @let owned = ownedFor(resource);
                          <div class="grid-row">
                            <span class="label">{{ label(resource) }}</span>
                            <span class="owned" aria-hidden="true">/ {{ owned }}</span>
                            <div class="stepper">
                              <button
                                type="button"
                                [disabled]="offerCount <= 0"
                                (click)="adjust(sideOffer, resource, -1)"
                              >
                                −
                              </button>
                              <span class="count">{{ offerCount }}</span>
                              <button
                                type="button"
                                [disabled]="offerCount >= owned"
                                (click)="adjust(sideOffer, resource, 1)"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        }
                      </div>
                      <div class="col">
                        <p>{{ 'trade.youWant' | translate }}</p>
                        @for (resource of order; track resource) {
                          @let requestCount = request()[resource];
                          <div class="grid-row">
                            <span class="label">{{ label(resource) }}</span>
                            <div class="stepper">
                              <button
                                type="button"
                                [disabled]="requestCount <= 0"
                                (click)="adjust(sideRequest, resource, -1)"
                              >
                                −
                              </button>
                              <span class="count">{{ requestCount }}</span>
                              <button
                                type="button"
                                (click)="adjust(sideRequest, resource, 1)"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        }
                      </div>
                    </div>
                    @if (!canSubmitPropose()) {
                      <p class="hint hint--soft">{{ 'trade.proposeHint' | translate }}</p>
                    }
                    <button
                      type="button"
                      class="confirm"
                      [disabled]="!canSubmitPropose() || hasAnyPending()"
                      (click)="emitPropose()"
                    >
                      @if (isPendingKind(pendingKindEnum.Propose)) {
                        <span class="spinner" aria-hidden="true"></span>
                        {{ 'trade.sending' | translate }}
                      } @else {
                        {{ 'trade.sendOffer' | translate }}
                      }
                    </button>
                  </div>
                }
              }
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
        width: min(94vw, 34rem);
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
      .sub-label {
        margin: 0.5rem 0 0.3rem;
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgba(247, 241, 225, 0.55);
      }
      .incoming-actions {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 0.4rem;
        margin-top: 0.4rem;
      }
      .trade-summary {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.7rem;
        background: rgba(255, 255, 255, 0.04);
        border-radius: 10px;
        padding: 0.55rem 0.7rem;
      }
      .trade-summary--banner {
        background: rgba(120, 160, 220, 0.12);
        border: 1px solid rgba(120, 160, 220, 0.3);
      }
      .trade-summary--mini {
        padding: 0.3rem 0.5rem;
        margin-top: 0.35rem;
        font-size: 0.78rem;
      }
      .trade-summary__caption {
        margin: 0 0 0.3rem;
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgba(247, 241, 225, 0.55);
      }
      .trade-summary__row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin: 0;
        padding: 0.12rem 0;
        font-size: 0.82rem;
      }
      .trade-summary__row--empty {
        color: rgba(247, 241, 225, 0.4);
        font-style: italic;
      }
      .trade-summary__row--lacking {
        color: #f7a98a;
      }
      .responses {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
      }
      .response {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        padding: 0.55rem 0.7rem;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }
      .response--compact {
        padding: 0.4rem 0.6rem;
      }
      .response--pending {
        border-color: rgba(255, 255, 255, 0.12);
      }
      .response--accepted {
        border-color: rgba(92, 194, 122, 0.55);
        background: rgba(92, 194, 122, 0.08);
      }
      .response--countered {
        border-color: rgba(213, 154, 58, 0.55);
        background: rgba(213, 154, 58, 0.08);
      }
      .response--rejected {
        border-color: rgba(220, 90, 80, 0.45);
        background: rgba(220, 90, 80, 0.06);
        opacity: 0.75;
      }
      .response__head {
        display: flex;
        justify-content: space-between;
        font-size: 0.85rem;
      }
      .response__name {
        font-weight: 600;
      }
      .response__status {
        font-size: 0.74rem;
        color: rgba(247, 241, 225, 0.65);
      }
      .response__finalize {
        margin-top: 0.2rem;
      }
      .own-status {
        margin: 0 0 0.35rem;
        font-size: 0.86rem;
        font-weight: 600;
      }
      .own-status--pending {
        color: rgba(247, 241, 225, 0.7);
      }
      .own-status--accepted {
        color: #b5e9c4;
      }
      .own-status--countered {
        color: #f3d196;
      }
      .own-status--rejected {
        color: #f3a5a0;
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
      .segmented {
        display: inline-flex;
        margin-bottom: 0.5rem;
        padding: 0.18rem;
        gap: 0.18rem;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      .segmented button {
        border: 0;
        background: transparent;
        color: rgba(247, 241, 225, 0.7);
        padding: 0.3rem 0.8rem;
        border-radius: 999px;
        font-size: 0.78rem;
      }
      .segmented button.active {
        background: linear-gradient(180deg, #4f8be0, #3563b4);
        color: #fff;
        box-shadow: 0 1px 6px rgba(0, 0, 0, 0.35);
      }
      .picker {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
      }
      .bank-pick-label {
        margin-right: 0.3rem;
      }
      .bank-pick-rate {
        font-size: 0.72rem;
        opacity: 0.9;
      }
      .bank-pick-owned {
        font-size: 0.72rem;
        opacity: 0.6;
        margin-left: 0.3rem;
      }
      .rate-best:not(.active) {
        border-color: rgba(213, 154, 58, 0.55);
        background: rgba(213, 154, 58, 0.1);
      }
      .bank-summary {
        margin: 0.2rem 0 0.6rem;
        font-size: 0.92rem;
        text-align: center;
        color: rgba(247, 241, 225, 0.9);
      }
      .trade-grid {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 0.4rem 1.4rem;
        margin: 0.4rem 0 0.6rem;
      }
      .col p {
        margin: 0 0 0.4rem;
        font-size: 0.8rem;
        font-weight: 600;
      }
      .grid-row {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        gap: 0.6rem;
        margin-bottom: 0.32rem;
      }
      .grid-row .label {
        font-size: 0.78rem;
        white-space: nowrap;
      }
      .grid-row .owned {
        font-size: 0.7rem;
        color: rgba(247, 241, 225, 0.45);
        margin-left: 0.15rem;
      }
      .grid-row .stepper {
        justify-self: end;
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
        transition: opacity 0.12s ease, background 0.12s ease;
      }
      button:disabled {
        opacity: 0.35;
        cursor: not-allowed;
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
      .revise {
        background: linear-gradient(180deg, #d59a3a, #a16f1d);
        border-color: transparent;
        color: #1f1408;
      }
      .composer-actions {
        display: flex;
        gap: 0.45rem;
        margin-top: 0.4rem;
      }
      .back {
        flex: 0 0 auto;
        background: transparent;
        border-color: rgba(255, 255, 255, 0.18);
      }
      .confirm {
        flex: 1 1 auto;
        background: linear-gradient(180deg, #4f8be0, #3563b4);
        border-color: transparent;
        color: #fff;
        padding: 0.55rem;
        margin-bottom: 0.5rem;
      }
      .composer-actions .confirm {
        margin-bottom: 0;
      }
      .hint {
        margin: 0 0 0.45rem;
        font-size: 0.76rem;
      }
      .hint--soft {
        color: rgba(247, 241, 225, 0.5);
      }
      .hint--warn {
        color: #f7a98a;
      }
      .hint--info {
        color: #f3d196;
      }
      .dismiss {
        width: 100%;
        background: transparent;
        border-color: rgba(255, 255, 255, 0.18);
        margin-top: 0.4rem;
      }
      .incoming-actions--countered {
        grid-template-columns: 1fr 1fr;
      }
      .spinner {
        display: inline-block;
        width: 0.8rem;
        height: 0.8rem;
        margin-right: 0.4rem;
        vertical-align: -2px;
        border: 2px solid rgba(255, 255, 255, 0.35);
        border-top-color: #fff;
        border-radius: 50%;
        animation: trade-spin 0.6s linear infinite;
      }
      @keyframes trade-spin {
        to {
          transform: rotate(360deg);
        }
      }
      /* Re-keyed @for ensures these animations restart on every status flip. */
      .response--pulse.response--accepted {
        animation: trade-pulse-accept 1.6s ease-out;
      }
      .response--pulse.response--countered {
        animation: trade-pulse-counter 1.6s ease-out;
      }
      .response--pulse.response--rejected {
        animation: trade-pulse-reject 1.4s ease-out;
      }
      @keyframes trade-pulse-accept {
        0% {
          box-shadow: 0 0 0 0 rgba(92, 194, 122, 0);
          background: rgba(92, 194, 122, 0.28);
        }
        60% {
          box-shadow: 0 0 0 8px rgba(92, 194, 122, 0);
        }
        100% {
          background: rgba(92, 194, 122, 0.08);
        }
      }
      @keyframes trade-pulse-counter {
        0% {
          box-shadow: 0 0 0 0 rgba(213, 154, 58, 0);
          background: rgba(213, 154, 58, 0.32);
        }
        60% {
          box-shadow: 0 0 0 8px rgba(213, 154, 58, 0);
        }
        100% {
          background: rgba(213, 154, 58, 0.08);
        }
      }
      @keyframes trade-pulse-reject {
        0% {
          background: rgba(220, 90, 80, 0.25);
        }
        100% {
          background: rgba(220, 90, 80, 0.06);
        }
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
    this.propose.emit({ recipients, offer: this.offer(), request: this.request() });
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
      offer: this.request(),
      request: this.offer(),
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
