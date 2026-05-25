import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { GamePhase } from '@catan/api-interfaces';
import { GameStateResource } from '../../core/game/game-state.resource';
import { LobbyShellGameUiService } from '../lobby-game-ui/lobby-shell-game-ui.service';
import { ShellFeedbackService } from '../shell-feedback/shell-feedback.service';
import { DisconnectBanner } from '../disconnect-banner/disconnect-banner';
import { UiFeedbackTone } from '../lobby-game-ui/lobby-ui-state';
import { SessionLobbyFlowService } from './session-lobby-flow.service';

@Component({
  selector: 'app-lobby-screen',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, DisconnectBanner],
  templateUrl: './lobby-screen.html',
  styleUrl: './lobby-screen.scss',
})
export class LobbyScreen {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly gameState = inject(GameStateResource);
  public readonly lobbyFlow = inject(SessionLobbyFlowService);
  public readonly lobbyGameUi = inject(LobbyShellGameUiService);
  public readonly shellFeedback = inject(ShellFeedbackService);
  public readonly feedbackToneEnum = UiFeedbackTone;

  public readonly lobbyCode = computed<string>(() => {
    const params = this.gameState.subscriptionParams();
    return params?.lobbyCode ?? this.route.parent?.snapshot.paramMap.get('lobbyCode') ?? '';
  });

  public constructor() {
    effect(() => {
      const phase = this.lobbyGameUi.lobbyUiState()?.phase;
      if (phase !== undefined && phase !== GamePhase.LobbyWaiting) {
        const code = this.lobbyCode();
        if (code.length > 0) {
          void this.router.navigate(['/lobby', code, 'game']);
        }
      }
    });
  }

  public startLobby(): void {
    if (!this.lobbyGameUi.canStartLobby()) {
      return;
    }
    this.gameState.startLobby();
  }

  public fillLobbyWithBots(): void {
    if (!this.lobbyGameUi.canFillLobbyWithBots()) {
      return;
    }
    this.gameState.fillLobbyWithBots();
  }
}
