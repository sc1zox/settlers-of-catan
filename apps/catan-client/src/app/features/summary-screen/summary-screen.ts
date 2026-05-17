import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LobbyShellGameUiService } from '../lobby-game-ui/lobby-shell-game-ui.service';
import { displayNameForSeat } from '../../shared/helper/lobby-game-ui/lobby-ui.mapper';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-summary-screen',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <div class="summary-screen" role="dialog" aria-modal="true">
      <div class="summary-screen__card">
        <h2 class="summary-screen__title">{{ 'summaryScreen.title' | translate }}</h2>
        <p class="summary-screen__winner">{{ winnerLine() }}</p>
        <p class="summary-screen__placeholder">{{ 'summaryScreen.statsPlaceholder' | translate }}</p>
        <button
          type="button"
          class="summary-screen__back"
          (click)="returnToMenu.emit()"
        >
          {{ 'summaryScreen.returnToMenu' | translate }}
        </button>
      </div>
    </div>
  `,
  styleUrl: './summary-screen.scss',
})
export class SummaryScreen {
  private readonly gameUi = inject(LobbyShellGameUiService);
  private readonly translate = inject(TranslateService);

  public readonly returnToMenu = output<void>();

  public readonly winnerLine = computed<string>(() => {
    const raw = this.gameUi.rawLobbyState();
    if (raw === undefined || raw.winnerSeat === null) {
      return this.translate.instant(marker('summaryScreen.noWinner'));
    }
    const winnerName = displayNameForSeat(raw, raw.winnerSeat, (key, params) =>
      this.translate.instant(key, params),
    );
    return this.translate.instant(marker('summaryScreen.winnerLine'), { winnerName });
  });
}
