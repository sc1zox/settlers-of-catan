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
import { RESOURCE_TYPE_ORDER, resourceTypeLabel } from '../../shared/i18n/resource-labels';

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
  templateUrl: './discard-modal.html',
  styleUrl: './discard-modal.scss',
})
export class DiscardModal {
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
