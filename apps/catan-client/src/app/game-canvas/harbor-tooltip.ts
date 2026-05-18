import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EnumTranslate } from '../../game/i18n/enum-translate.helper';
import { HarborInfo, HarborKind } from '../../game/world/harbors';

export interface HarborTooltipModel {
  readonly harbor: HarborInfo;
  readonly x: number;
  readonly y: number;
}

@Component({
  selector: 'app-harbor-tooltip',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './harbor-tooltip.html',
  styleUrl: './harbor-tooltip.scss',
})
export class HarborTooltip {
  private readonly translate = inject(TranslateService);
  readonly model = input<HarborTooltipModel | null>(null);

  readonly detail = computed(() => {
    const m = this.model();
    if (!m) {
      return '';
    }
    if (m.harbor.kind === HarborKind.Generic) {
      return this.translate.instant(marker('harbor.detailGeneric'));
    }
    const resource = m.harbor.resource;
    if (!resource) {
      return '';
    }
    const label = this.translate.instant(marker(EnumTranslate.tileKey(resource)));
    return this.translate.instant(marker('harbor.detailTwoForOne'), {
      resourceLabel: label,
    });
  });
}
