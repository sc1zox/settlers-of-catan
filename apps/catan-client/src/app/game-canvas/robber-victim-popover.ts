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
  template: `
    @let m = model();
    @if (m) {
      <div class="popover" [style.left.px]="m.x" [style.top.px]="m.y">
        <p class="title">{{ 'robberVictim.title' | translate }}</p>
        <div class="list">
          @for (candidate of m.candidates; track candidate.seat) {
            <button type="button" (click)="pick.emit(candidate.seat)">{{ candidate.name }}</button>
          }
          @if (m.candidates.length === 0) {
            <button type="button" class="none" (click)="pick.emit(null)">
              {{ 'robberVictim.none' | translate }}
            </button>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 26;
      }
      .popover {
        position: fixed;
        transform: translate(-50%, -120%);
        pointer-events: auto;
        background: rgba(20, 16, 12, 0.95);
        border: 1px solid rgba(255, 200, 130, 0.6);
        border-radius: 12px;
        padding: 0.7rem 0.8rem 0.8rem;
        box-shadow: 0 14px 40px rgba(0, 0, 0, 0.55);
        backdrop-filter: blur(6px);
      }
      .title {
        margin: 0 0 0.5rem;
        font-size: 0.82rem;
        color: #f7f1e1;
        text-align: center;
        white-space: nowrap;
      }
      .list {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      button {
        appearance: none;
        cursor: pointer;
        border-radius: 8px;
        padding: 0.34rem 0.9rem;
        font-size: 0.82rem;
        font-weight: 600;
        border: 1px solid transparent;
        background: linear-gradient(180deg, #4f8be0, #3563b4);
        color: #fff;
      }
      .none {
        background: rgba(255, 255, 255, 0.08);
        color: #f7f1e1;
        border-color: rgba(255, 255, 255, 0.18);
      }
    `,
  ],
})
export class RobberVictimPopoverComponent {
  readonly model = input<RobberVictimModel | null>(null);
  readonly pick = output<PlayerSeat | null>();
}
