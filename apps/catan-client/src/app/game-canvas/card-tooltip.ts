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
  templateUrl: './card-tooltip.html',
  styleUrl: './card-tooltip.scss',
})
export class CardTooltip {
  readonly model = input<CardTooltipModel | null>(null);
}
