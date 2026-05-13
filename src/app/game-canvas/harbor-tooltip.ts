import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { HarborInfo, HarborKind } from '../../game/world/harbors';
import { TileType } from '../../game/board/tile-types';

const RESOURCE_LABEL_DE: Record<TileType, string> = {
  [TileType.Forest]: 'Holz',
  [TileType.Fields]: 'Getreide',
  [TileType.Pasture]: 'Wolle',
  [TileType.Hills]: 'Lehm',
  [TileType.Mountains]: 'Erz',
  [TileType.Desert]: 'Wüste',
  [TileType.Water]: 'Wasser',
};

export interface HarborTooltipModel {
  readonly harbor: HarborInfo;
  readonly x: number;
  readonly y: number;
}

@Component({
  selector: 'app-harbor-tooltip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let m = model();
    @if (m) {
      <div class="tooltip" [style.left.px]="m.x + 14" [style.top.px]="m.y + 14">
        <div class="ratio">{{ m.harbor.ratioFrom }} : {{ m.harbor.ratioTo }}</div>
        <div class="title">Hafen</div>
        <div class="detail">{{ detail() }}</div>
      </div>
    }
  `,
  styleUrl: './harbor-tooltip.scss',
})
export class HarborTooltipComponent {
  readonly model = input<HarborTooltipModel | null>(null);

  readonly detail = computed(() => {
    const m = this.model();
    if (!m) return '';
    if (m.harbor.kind === HarborKind.Generic) {
      return 'Tausche 3 gleiche Rohstoffe gegen 1 anderen.';
    }
    const resource = m.harbor.resource;
    if (!resource) return '';
    const label = RESOURCE_LABEL_DE[resource];
    return `Tausche 2 ${label} gegen 1 anderen Rohstoff.`;
  });
}
