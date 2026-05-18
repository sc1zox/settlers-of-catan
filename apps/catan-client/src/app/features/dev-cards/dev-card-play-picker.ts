import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ResourceType } from '@catan/api-interfaces';
import { TranslateInstantFn } from '../../../shared/i18n/translate-instant-fn';
import { RESOURCE_TYPE_ORDER, resourceTypeLabel } from '../../../shared/i18n/resource-labels';

export type DevCardPlayPickerModel =
  | { readonly kind: 'monopoly' }
  | { readonly kind: 'yearOfPlenty' }
  | null;

export interface YearOfPlentyPick {
  readonly first: ResourceType;
  readonly second: ResourceType;
}

/**
 * Resource picker shown after the user clicks the per-card "Play" button on a
 * Monopoly or Year-of-Plenty dev card. The card itself has already been chosen
 * in the focused-card overlay, so this component only collects the resource
 * argument(s) the server needs.
 */
@Component({
  selector: 'app-dev-card-play-picker',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dev-card-play-picker.html',
  styleUrl: './dev-card-play-picker.scss',
})
export class DevCardPlayPicker {
  private readonly translate = inject(TranslateService);
  private readonly instant: TranslateInstantFn = (key, params) =>
    this.translate.instant(marker(key), params);

  readonly model = input<DevCardPlayPickerModel>(null);
  readonly monopolyPicked = output<ResourceType>();
  readonly plentyPicked = output<YearOfPlentyPick>();
  readonly cancelled = output<void>();

  protected readonly order = RESOURCE_TYPE_ORDER;
  protected readonly monopolyResource = signal<ResourceType>(ResourceType.Wheat);
  protected readonly plentyFirst = signal<ResourceType>(ResourceType.Wood);
  protected readonly plentySecond = signal<ResourceType>(ResourceType.Brick);

  protected label(resource: ResourceType): string {
    return resourceTypeLabel(this.instant, resource);
  }
}
