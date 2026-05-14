import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslateService } from '@ngx-translate/core';
import { TranslationKey } from '../../../shared/i18n/translation-key.enum';
import { SpectatorCameraService } from './spectator-camera.service';

@Component({
  selector: 'app-spectator-camera-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <button
        type="button"
        class="spectator-cam-toggle"
        [class.spectator-cam-toggle--active]="camera.mode()"
        [attr.aria-pressed]="camera.mode()"
        [attr.title]="camera.mode() ? titleOn() : titleOff()"
        (click)="camera.toggle()"
        [attr.aria-label]="ariaLabel()"
      >
        <svg class="spectator-cam-toggle__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"
          />
        </svg>
      </button>
    }
  `,
  styleUrl: './spectator-camera-toggle.scss',
})
export class SpectatorCameraToggle {
  protected readonly camera = inject(SpectatorCameraService);
  private readonly translate = inject(TranslateService);
  readonly visible = input<boolean>(true);

  protected titleOn(): string {
    return this.translate.instant(marker(TranslationKey.SpectatorTitleOn));
  }

  protected titleOff(): string {
    return this.translate.instant(marker(TranslationKey.SpectatorTitleOff));
  }

  protected ariaLabel(): string {
    return this.translate.instant(marker(TranslationKey.SpectatorAriaToggle));
  }
}
