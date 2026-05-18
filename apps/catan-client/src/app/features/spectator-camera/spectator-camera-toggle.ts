import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslateService } from '@ngx-translate/core';
import { TranslationKey } from '../../../shared/i18n/translation-key.enum';
import { SpectatorCameraService } from './spectator-camera.service';

@Component({
  selector: 'app-spectator-camera-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './spectator-camera-toggle.html',
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
