import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ResourceType } from '@catan/api-interfaces';
import { TranslateInstantFn } from '../../../shared/i18n/translate-instant-fn';
import { RESOURCE_TYPE_ORDER, resourceTypeLabel } from '../../../shared/i18n/resource-labels';

export interface YearOfPlentyPick {
  readonly first: ResourceType;
  readonly second: ResourceType;
}

type DevModalView = 'menu' | 'monopoly' | 'plenty';

/**
 * Opened by clicking a dev card in the 3D scene. Dev cards travel as a count
 * only, so the modal offers all four playable actions as buttons — the server
 * validates that the player actually owns the chosen card.
 */
@Component({
  selector: 'app-dev-card-modal',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dev-card-modal.html',
  styleUrl: './dev-card-modal.scss',
})
export class DevCardModal {
  private readonly translate = inject(TranslateService);
  private readonly instant: TranslateInstantFn = (key, params) =>
    this.translate.instant(marker(key), params);

  readonly open = input<boolean>(false);
  readonly playKnight = output<void>();
  readonly playMonopoly = output<ResourceType>();
  readonly playYearOfPlenty = output<YearOfPlentyPick>();
  readonly playRoadBuilding = output<void>();
  readonly closed = output<void>();

  protected readonly order = RESOURCE_TYPE_ORDER;

  /** Resets to the action menu whenever the modal is (re)opened. */
  protected readonly view = linkedSignal<boolean, DevModalView>({
    source: () => this.open(),
    computation: () => 'menu',
  });

  protected readonly monopolyResource = signal<ResourceType>(ResourceType.Wheat);
  protected readonly plentyFirst = signal<ResourceType>(ResourceType.Wood);
  protected readonly plentySecond = signal<ResourceType>(ResourceType.Brick);

  protected label(resource: ResourceType): string {
    return resourceTypeLabel(this.instant, resource);
  }
}
