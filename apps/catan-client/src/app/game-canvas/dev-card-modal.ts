import {
  ChangeDetectionStrategy,
  Component,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { ResourceType } from '@catan/api-interfaces';
import { RESOURCE_TYPE_LABEL_DE, RESOURCE_TYPE_ORDER } from '../shared/resource-labels';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="layer">
        <button
          type="button"
          class="backdrop"
          aria-label="Modal schließen"
          (click)="closed.emit()"
        ></button>
        <div class="modal">
          <h3>Entwicklungskarte spielen</h3>

          @switch (view()) {
            @case ('menu') {
              <div class="actions">
                <button type="button" (click)="playKnight.emit()">Ritter</button>
                <button type="button" (click)="view.set('monopoly')">Monopol</button>
                <button type="button" (click)="view.set('plenty')">Erfindung</button>
                <button type="button" (click)="playRoadBuilding.emit()">Straßenbau</button>
              </div>
            }
            @case ('monopoly') {
              <p class="hint">Welcher Rohstoff?</p>
              <div class="picker">
                @for (resource of order; track resource) {
                  <button
                    type="button"
                    [class.active]="monopolyResource() === resource"
                    (click)="monopolyResource.set(resource)"
                  >
                    {{ label(resource) }}
                  </button>
                }
              </div>
              <button
                type="button"
                class="confirm"
                (click)="playMonopoly.emit(monopolyResource())"
              >
                Monopol spielen
              </button>
            }
            @case ('plenty') {
              <p class="hint">Erste Karte</p>
              <div class="picker">
                @for (resource of order; track resource) {
                  <button
                    type="button"
                    [class.active]="plentyFirst() === resource"
                    (click)="plentyFirst.set(resource)"
                  >
                    {{ label(resource) }}
                  </button>
                }
              </div>
              <p class="hint">Zweite Karte</p>
              <div class="picker">
                @for (resource of order; track resource) {
                  <button
                    type="button"
                    [class.active]="plentySecond() === resource"
                    (click)="plentySecond.set(resource)"
                  >
                    {{ label(resource) }}
                  </button>
                }
              </div>
              <button
                type="button"
                class="confirm"
                (click)="
                  playYearOfPlenty.emit({ first: plentyFirst(), second: plentySecond() })
                "
              >
                Erfindung spielen
              </button>
            }
          }

          <button type="button" class="dismiss" (click)="closed.emit()">Schließen</button>
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
        z-index: 30;
      }
      .layer {
        position: absolute;
        inset: 0;
        pointer-events: auto;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .backdrop {
        position: absolute;
        inset: 0;
        border: 0;
        padding: 0;
        cursor: default;
        background: rgba(8, 6, 10, 0.62);
        backdrop-filter: blur(2px);
      }
      .modal {
        position: relative;
        width: min(92vw, 24rem);
        background: rgba(20, 16, 12, 0.97);
        border: 1px solid rgba(255, 200, 130, 0.5);
        border-radius: 16px;
        padding: 1.3rem 1.4rem 1.2rem;
        color: #f7f1e1;
        box-shadow: 0 22px 70px rgba(0, 0, 0, 0.6);
      }
      h3 {
        margin: 0 0 0.9rem;
        font-size: 1.05rem;
      }
      .hint {
        margin: 0.2rem 0 0.5rem;
        font-size: 0.8rem;
        color: rgba(247, 241, 225, 0.7);
      }
      .actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.5rem;
      }
      .actions button {
        padding: 0.7rem 0.5rem;
      }
      .picker {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        margin-bottom: 0.7rem;
      }
      button {
        appearance: none;
        cursor: pointer;
        border-radius: 9px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        background: rgba(255, 255, 255, 0.08);
        color: #f7f1e1;
        font-size: 0.82rem;
        font-weight: 600;
        padding: 0.36rem 0.7rem;
      }
      button.active {
        background: linear-gradient(180deg, #4f8be0, #3563b4);
        border-color: transparent;
        color: #fff;
      }
      .confirm {
        width: 100%;
        background: linear-gradient(180deg, #4f8be0, #3563b4);
        border-color: transparent;
        color: #fff;
        padding: 0.55rem;
        margin-bottom: 0.5rem;
      }
      .dismiss {
        width: 100%;
        background: transparent;
        border-color: rgba(255, 255, 255, 0.18);
      }
    `,
  ],
})
export class DevCardModalComponent {
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
    return RESOURCE_TYPE_LABEL_DE[resource];
  }
}
