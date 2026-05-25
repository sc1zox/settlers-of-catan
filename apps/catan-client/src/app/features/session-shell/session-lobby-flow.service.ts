import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslateService } from '@ngx-translate/core';
import { GamePhase, isLobbyCodeValid } from '@catan/api-interfaces';
import { ClientStorageKey } from '../../../shared/client-constants';
import { GameStateResource } from '../../core/game/game-state.resource';
import { GameSocketService } from '../../core/socket/game-socket.service';
import { LobbyLiveKitService } from '../webcam-head/lobby-livekit.service';
import { LobbyUiStep, UiFeedbackTone } from '../lobby-game-ui/lobby-ui-state';
import { LobbyShellGameUiService } from '../lobby-game-ui/lobby-shell-game-ui.service';
import { ShellFeedbackService } from '../shell-feedback/shell-feedback.service';
import { SpectatorCameraService } from '../spectator-camera/spectator-camera.service';
import {
  resolveUserFacingErrorMessage,
} from '../shell-feedback/user-facing-error';

@Injectable()
export class SessionLobbyFlowService {
  private readonly router = inject(Router);
  private readonly gameState = inject(GameStateResource);
  private readonly sockets = inject(GameSocketService);
  private readonly shellFeedback = inject(ShellFeedbackService);
  private readonly liveKit = inject(LobbyLiveKitService);
  private readonly spectatorCamService = inject(SpectatorCameraService);
  private readonly translate = inject(TranslateService);
  private readonly lobbyGameUi = inject(LobbyShellGameUiService);
  private readonly destroyRef = inject(DestroyRef);

  public readonly joinInProgress = signal<boolean>(false);
  public readonly leaveLobbyPromptOpen = signal<boolean>(false);

  public readonly isJoinInProgress = computed<boolean>(() => this.joinInProgress());

  public readonly uiStep = computed<LobbyUiStep>(() => {
    const state = this.lobbyGameUi.lobbyUiState();
    if (state === null) {
      return LobbyUiStep.Lobby;
    }
    if (state.phase === GamePhase.LobbyWaiting) {
      return LobbyUiStep.Lobby;
    }
    return LobbyUiStep.InGame;
  });

  public readonly summaryScreenVisible = computed<boolean>(() => {
    return this.lobbyGameUi.lobbyUiState()?.phase === GamePhase.Summary;
  });

  public constructor() {
    effect(() => {
      if (this.uiStep() === LobbyUiStep.Lobby) {
        this.spectatorCamService.reset();
      }
    });
    this.sockets.lobbyTerminated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.backToJoinLobby();
        this.shellFeedback.setFeedback(
          UiFeedbackTone.Info,
          this.translate.instant(marker('shell.lobbyTerminated')),
        );
      });
  }

  public connectToLobbyFromRoute(lobbyCode: string): void {
    if (this.gameState.subscriptionParams() !== undefined) {
      return;
    }
    const displayName = this.readDisplayName();
    if (displayName.length === 0) {
      void this.router.navigate(['/sign-in']);
      return;
    }
    if (!isLobbyCodeValid(lobbyCode)) {
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Error,
        this.translate.instant(marker('shell.lobbyCodeTooShortRun')),
      );
      void this.router.navigate(['/join']);
      return;
    }
    void this.runReconnectLobby(lobbyCode, displayName);
  }

  public leaveCurrentLobby(): void {
    const phase = this.lobbyGameUi.lobbyUiState()?.phase;
    if (phase === GamePhase.LobbyWaiting) {
      this.gameState.leaveLobby();
      return;
    }
    if (phase !== undefined) {
      this.sockets.disconnect();
    }
  }

  public requestLeaveLobby(): void {
    this.leaveLobbyPromptOpen.set(true);
  }

  public dismissLeaveLobbyPrompt(): void {
    this.leaveLobbyPromptOpen.set(false);
  }

  public confirmLeaveLobby(): void {
    this.leaveLobbyPromptOpen.set(false);
    this.backToJoinLobby();
  }

  public backToJoinLobby(): void {
    this.leaveCurrentLobby();
    void this.liveKit.abandonPrimedLocalVideoCapture();
    void this.liveKit.disconnect();
    this.gameState.disconnectLobby();
    this.joinInProgress.set(false);
    this.spectatorCamService.reset();
    this.shellFeedback.setFeedback(
      UiFeedbackTone.Info,
      this.translate.instant(marker('shell.backToJoinLobby')),
    );
    void this.router.navigate(['/join']);
  }

  private async runReconnectLobby(lobbyCode: string, displayName: string): Promise<void> {
    this.joinInProgress.set(true);
    this.shellFeedback.setFeedback(
      UiFeedbackTone.Info,
      this.translate.instant(marker('shell.joinConnecting'), { lobbyCode }),
    );
    try {
      const joined = await this.gameState.joinLobby(lobbyCode, displayName);
      this.joinInProgress.set(false);
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Success,
        this.translate.instant(
          joined.lobbyIdleRecycled === true
            ? marker('shell.joinSuccessRecycledStaleLobby')
            : marker('shell.joinSuccess'),
          { lobbyCode: joined.lobbyCode },
        ),
      );
      if (joined.liveKit !== undefined) {
        void this.liveKit.connect(joined.liveKit).catch(() => {
          this.shellFeedback.setFeedback(
            UiFeedbackTone.Info,
            this.translate.instant(marker('shell.liveKitConnectFailed')),
          );
        });
      }
    } catch (error: unknown) {
      void this.liveKit.abandonPrimedLocalVideoCapture();
      void this.liveKit.disconnect();
      this.gameState.disconnectLobby();
      this.joinInProgress.set(false);
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Error,
        resolveUserFacingErrorMessage(
          this.translate,
          error,
          marker('shell.joinFailed'),
          { lobbyCode },
        ),
      );
      void this.router.navigate(['/join']);
    }
  }

  private readDisplayName(): string {
    try {
      return localStorage.getItem(ClientStorageKey.DisplayName) ?? '';
    } catch {
      return '';
    }
  }
}
