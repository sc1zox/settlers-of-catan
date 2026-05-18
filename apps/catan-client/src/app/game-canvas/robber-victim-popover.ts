import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { PlayerSeat } from '@catan/api-interfaces';

export interface RobberVictimCandidate {
  readonly seat: PlayerSeat;
  readonly name: string;
}

export interface RobberVictimModel {
  readonly x: number;
  readonly y: number;
  readonly candidates: readonly RobberVictimCandidate[];
}

@Component({
  selector: 'app-robber-victim-popover',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './robber-victim-popover.html',
  styleUrl: './robber-victim-popover.scss',
})
export class RobberVictimPopover {
  readonly model = input<RobberVictimModel | null>(null);
  readonly pick = output<PlayerSeat | null>();
}
