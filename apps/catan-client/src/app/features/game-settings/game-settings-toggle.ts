import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslateService } from '@ngx-translate/core';
import { TranslationKey } from '../../../shared/i18n/translation-key.enum';
import { GameSettingsPanel } from './game-settings-panel';
import { GameSettingsService } from './game-settings.service';

@Component({
  selector: 'app-game-settings-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GameSettingsPanel],
  templateUrl: './game-settings-toggle.html',
  styleUrl: './game-settings-toggle.scss',
})
export class GameSettingsToggle {
  protected readonly settings = inject(GameSettingsService);
  private readonly translate = inject(TranslateService);
  public readonly visible = input<boolean>(true);

  protected title(): string {
    return this.translate.instant(marker(TranslationKey.SettingsTitle));
  }

  protected ariaLabel(): string {
    return this.translate.instant(marker(TranslationKey.SettingsAriaToggle));
  }

  protected formatNumber(value: number, digits: number): string {
    return value.toFixed(digits);
  }
}
