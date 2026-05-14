import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BuildKind } from '@catan/api-interfaces';
import { EnumTranslate } from '../../game/i18n/enum-translate.helper';

export interface BuildConfirmModel {
  readonly kind: BuildKind;
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

@Component({
  selector: 'app-build-confirm-popover',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let m = model();
    @if (m) {
      <div class="popover" [style.left.px]="m.x" [style.top.px]="m.y">
        <p class="title">{{ titleFor(m.kind) }}</p>
        <div class="row">
          <button type="button" class="yes" (click)="confirm.emit()">
            {{ 'buildConfirm.yes' | translate }}
          </button>
          <button type="button" class="no" (click)="dismiss.emit()">
            {{ 'buildConfirm.no' | translate }}
          </button>
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
        padding: 0.7rem 0.9rem 0.8rem;
        box-shadow: 0 14px 40px rgba(0, 0, 0, 0.55);
        backdrop-filter: blur(6px);
        text-align: center;
        animation: build-pop 160ms cubic-bezier(0.2, 1.3, 0.4, 1);
      }
      .title {
        margin: 0 0 0.55rem;
        font-size: 0.84rem;
        color: #f7f1e1;
        white-space: nowrap;
      }
      .row {
        display: flex;
        gap: 0.5rem;
        justify-content: center;
      }
      button {
        appearance: none;
        cursor: pointer;
        border-radius: 8px;
        padding: 0.32rem 0.95rem;
        font-size: 0.82rem;
        font-weight: 600;
        border: 1px solid transparent;
      }
      .yes {
        background: linear-gradient(180deg, #4f8be0, #3563b4);
        color: #fff;
      }
      .no {
        background: rgba(255, 255, 255, 0.08);
        color: #f7f1e1;
        border-color: rgba(255, 255, 255, 0.18);
      }
      @keyframes build-pop {
        0% {
          opacity: 0;
          transform: translate(-50%, -110%) scale(0.85);
        }
        100% {
          opacity: 1;
          transform: translate(-50%, -120%) scale(1);
        }
      }
    `,
  ],
})
export class BuildConfirmPopoverComponent {
  private readonly translate = inject(TranslateService);
  readonly model = input<BuildConfirmModel | null>(null);
  readonly confirm = output<void>();
  readonly dismiss = output<void>();

  protected titleFor(kind: BuildKind): string {
    return EnumTranslate.translateBuildKindConfirm(
      (key, params) => this.translate.instant(marker(key), params),
      kind,
    );
  }
}
