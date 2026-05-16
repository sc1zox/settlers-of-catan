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
  template: `
    @let m = model();
    @if (m) {
      <button class="card" type="button" (click)="dismiss.emit()" [attr.data-nonce]="m.nonce">
        <div class="label">{{ 'dice.resultLabel' | translate }}</div>
        <div class="dice">
          <span class="die">{{ m.result.a }}</span>
          <span class="plus">+</span>
          <span class="die">{{ m.result.b }}</span>
        </div>
        <div class="sum">= {{ m.result.sum }}</div>
        <div class="hint">{{ 'dice.tapHint' | translate }}</div>
      </button>
    }
  `,
  styleUrl: './dice-overlay.scss',
})
export class DiceOverlayComponent {
  readonly model = input<DiceOverlayModel | null>(null);
  readonly dismiss = output<void>();
}
