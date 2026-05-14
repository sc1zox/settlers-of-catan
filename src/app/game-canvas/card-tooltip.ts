import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface CardTooltipModel {
  readonly title: string;
  readonly detail: string;
  readonly x: number;
  readonly y: number;
}

@Component({
  selector: 'app-card-tooltip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let m = model();
    @if (m) {
      <div class="tooltip" [style.left.px]="m.x + 14" [style.top.px]="m.y + 14">
        <div class="title">{{ m.title }}</div>
        <div class="detail">{{ m.detail }}</div>
      </div>
    }
  `,
  styleUrl: './card-tooltip.scss',
})
export class CardTooltipComponent {
  readonly model = input<CardTooltipModel | null>(null);
}
