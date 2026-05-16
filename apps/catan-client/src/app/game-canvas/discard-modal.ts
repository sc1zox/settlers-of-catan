import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ResourceType } from '@catan/api-interfaces';
import { TranslateInstantFn } from '../../shared/i18n/translate-instant-fn';
import { RESOURCE_TYPE_ORDER, resourceTypeLabel } from '../shared/resource-labels';

export interface DiscardModalModel {
  /** Number of cards the player must discard (floor of hand size). */
  readonly required: number;
  /** The player's current resource hand — caps each stepper. */
  readonly handCounts: Readonly<Record<ResourceType, number>>;
}

/**
 * Auto-opened modal: after a 7 the player picks which `required` resource
 * cards to drop. Submit unlocks only once the selection matches `required`.
 */
@Component({
  selector: 'app-discard-modal',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let m = model();
    @if (m) {
      <div class="backdrop">
        <div class="modal">
          <h3>{{ 'discard.title' | translate }}</h3>
          <p class="hint">
            {{ 'discard.hint' | translate: { required: m.required, selected: total() } }}
          </p>
          <ul class="rows">
            @for (resource of order; track resource) {
              <li>
                <span class="label">{{ label(resource) }}</span>
                <span class="have">{{ m.handCounts[resource] }}</span>
                <div class="stepper">
                  <button type="button" (click)="dec(resource)" [disabled]="count(resource) === 0">
                    −
                  </button>
                  <span class="count">{{ count(resource) }}</span>
                  <button
                    type="button"
                    (click)="inc(resource, m.handCounts[resource])"
                    [disabled]="count(resource) >= m.handCounts[resource] || total() >= m.required"
                  >
                    +
                  </button>
                </div>
              </li>
            }
          </ul>
          <button
            type="button"
            class="submit"
            [disabled]="total() !== m.required"
            (click)="confirmed.emit(selected())"
          >
            {{ 'discard.submit' | translate }}
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
      .backdrop {
        position: absolute;
        inset: 0;
        pointer-events: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(8, 6, 10, 0.62);
        backdrop-filter: blur(2px);
      }
      .modal {
        width: min(92vw, 26rem);
        background: rgba(20, 16, 12, 0.97);
        border: 1px solid rgba(255, 200, 130, 0.5);
        border-radius: 16px;
        padding: 1.3rem 1.4rem 1.4rem;
        color: #f7f1e1;
        box-shadow: 0 22px 70px rgba(0, 0, 0, 0.6);
      }
      h3 {
        margin: 0 0 0.4rem;
        font-size: 1.05rem;
      }
      .hint {
        margin: 0 0 0.9rem;
        font-size: 0.82rem;
        color: rgba(247, 241, 225, 0.7);
      }
      .rows {
        list-style: none;
        margin: 0 0 1rem;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
      }
      li {
        display: grid;
        grid-template-columns: 1fr auto auto;
        align-items: center;
        gap: 0.7rem;
      }
      .have {
        font-size: 0.78rem;
        color: rgba(247, 241, 225, 0.5);
      }
      .stepper {
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }
      .stepper button {
        width: 1.7rem;
        height: 1.7rem;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        background: rgba(255, 255, 255, 0.08);
        color: #f7f1e1;
        cursor: pointer;
        font-size: 1rem;
        line-height: 1;
      }
      .stepper button:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }
      .count {
        min-width: 1.1rem;
        text-align: center;
        font-weight: 600;
      }
      .submit {
        width: 100%;
        appearance: none;
        cursor: pointer;
        border: none;
        border-radius: 10px;
        padding: 0.6rem;
        font-weight: 600;
        color: #fff;
        background: linear-gradient(180deg, #4f8be0, #3563b4);
      }
      .submit:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
    `,
  ],
})
export class DiscardModalComponent {
  private readonly translate = inject(TranslateService);
  private readonly instant: TranslateInstantFn = (key, params) =>
    this.translate.instant(marker(key), params);

  readonly model = input<DiscardModalModel | null>(null);
  readonly confirmed = output<Readonly<Record<ResourceType, number>>>();

  protected readonly order = RESOURCE_TYPE_ORDER;

  /** Per-resource discard selection — resets to zero whenever the model changes. */
  protected readonly selected = linkedSignal<
    DiscardModalModel | null,
    Record<ResourceType, number>
  >({
    source: () => this.model(),
    computation: () => this.zeroCounts(),
  });

  protected readonly total = computed<number>(() => {
    const counts = this.selected();
    let sum = 0;
    for (let i = 0; i < this.order.length; i += 1) {
      sum += counts[this.order[i]];
    }
    return sum;
  });

  protected label(resource: ResourceType): string {
    return resourceTypeLabel(this.instant, resource);
  }

  protected count(resource: ResourceType): number {
    return this.selected()[resource];
  }

  protected inc(resource: ResourceType, cap: number): void {
    const counts = { ...this.selected() };
    if (counts[resource] < cap) {
      counts[resource] += 1;
      this.selected.set(counts);
    }
  }

  protected dec(resource: ResourceType): void {
    const counts = { ...this.selected() };
    if (counts[resource] > 0) {
      counts[resource] -= 1;
      this.selected.set(counts);
    }
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
