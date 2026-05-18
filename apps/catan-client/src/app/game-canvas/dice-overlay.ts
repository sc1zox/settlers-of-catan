import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { DiceRollResult } from '../../game/dice/dice-tray';

export interface DiceOverlayModel {
  readonly result: DiceRollResult;
  readonly nonce: number;
}

@Component({
  selector: 'app-dice-overlay',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dice-overlay.html',
  styleUrl: './dice-overlay.scss',
})
export class DiceOverlay {
  readonly model = input<DiceOverlayModel | null>(null);
  readonly dismiss = output<void>();
}
