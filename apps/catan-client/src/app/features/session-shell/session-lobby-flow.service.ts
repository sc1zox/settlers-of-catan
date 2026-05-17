import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslateService } from '@ngx-translate/core';
import { GamePhase, LiveKitCredentialsPayload, isLobbyCodeValid } from '@catan/api-interfaces';
import { GameStateResource } from '../../core/game/game-state.resource';
import { GameSocketService } from '../../core/socket/game-socket.service';
import { PlayerSessionService } from '../../core/session/player-session.service';
import { GameSettingsService } from '../game-settings/game-settings.service';
import { LobbyLiveKitService } from '../webcam-head/lobby-livekit.service';
import { LobbyUiStep, SessionUiState, UiFeedbackTone } from '../lobby-game-ui/lobby-ui-state';
import { LobbyShellGameUiService } from '../lobby-game-ui/lobby-shell-game-ui.service';
import { ShellFeedbackService } from '../shell-feedback/shell-feedback.service';
import { SpectatorCameraService } from '../spectator-camera/spectator-camera.service';
import {
  resolveUserFacingErrorMessage,
  userFacingErrorMessageFromCode,
} from '../shell-feedback/user-facing-error';

@Injectable()
export class SessionLobbyFlowService {
  private readonly gameState = inject(GameStateResource);
  private readonly sockets = inject(GameSocketService);
  private readonly shellFeedback = inject(ShellFeedbackService);
  private readonly playerSession = inject(PlayerSessionService);
  private readonly liveKit = inject(LobbyLiveKitService);
  private readonly gameSettings = inject(GameSettingsService);
  private readonly spectatorCamService = inject(SpectatorCameraService);
  private readonly translate = inject(TranslateService);
  private readonly lobbyGameUi = inject(LobbyShellGameUiService);
  private readonly destroyRef = inject(DestroyRef);

  public readonly uiStep = signal<LobbyUiStep>(LobbyUiStep.SignIn);
  public readonly sessionState = signal<SessionUiState | null>(null);
  public readonly joinInProgress = signal<boolean>(false);
  public readonly leaveLobbyPromptOpen = signal<boolean>(false);

  public readonly isJoinInProgress = computed<boolean>(() => this.joinInProgress());

  public readonly summaryScreenVisible = computed<boolean>(() => {
    return this.lobbyGameUi.lobbyUiState()?.phase === GamePhase.Summary;
  });

  public constructor() {
    this.lobbyGameUi.attachUiStep(this.uiStep);
    effect(() => {
      const state = this.lobbyGameUi.lobbyUiState();
      if (state === null) {
        return;
      }
      if (state.phase === GamePhase.LobbyWaiting) {
        if (this.uiStep() === LobbyUiStep.InGame) {
          this.uiStep.set(LobbyUiStep.Lobby);
        }
        return;
      }
      if (this.uiStep() !== LobbyUiStep.InGame) {
        this.uiStep.set(LobbyUiStep.InGame);
      }
    });
    effect(() => {
      if (this.uiStep() === LobbyUiStep.SignIn) {
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

  public leaveCurrentLobby(): void {
    const phase = this.lobbyGameUi.lobbyUiState()?.phase;
    if (phase === GamePhase.LobbyWaiting) {
      this.gameState.leaveLobby();
      return;
    }
    if (phase !== undefined) {
      // Mid-game / finished: the server's `LeaveLobby` handler ignores us here.
      // Drop the socket so the existing disconnect → grace → cleanup pipeline runs.
      this.sockets.disconnect();
    }
  }

  public submitStartSession(normalizedDisplayName: string): void {
    void this.runStartSession(normalizedDisplayName);
  }

  public submitJoinLobby(sessionState: SessionUiState | null, lobbyCodeInput: string): void {
    void this.runJoinLobby(sessionState, lobbyCodeInput);
  }

  public submitCreateLobby(sessionState: SessionUiState | null, lobbyCodeInput: string): void {
    void this.runCreateLobby(sessionState, lobbyCodeInput);
  }

  public backToSignIn(): void {
    void this.liveKit.abandonPrimedLocalVideoCapture();
    this.joinInProgress.set(false);
    this.spectatorCamService.reset();
    this.uiStep.set(LobbyUiStep.SignIn);
    this.shellFeedback.setFeedback(
      UiFeedbackTone.Info,
      this.translate.instant(marker('shell.backToSignIn')),
    );
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
    this.uiStep.set(LobbyUiStep.JoinLobby);
    this.shellFeedback.setFeedback(
      UiFeedbackTone.Info,
      this.translate.instant(marker('shell.backToJoinLobby')),
    );
  }

  public resetSession(): void {
    this.leaveCurrentLobby();
    void this.liveKit.abandonPrimedLocalVideoCapture();
    void this.liveKit.disconnect();
    this.gameState.disconnectLobby();
    this.playerSession.clear();
    this.sessionState.set(null);
    this.joinInProgress.set(false);
    this.shellFeedback.clearFeedback();
    this.spectatorCamService.reset();
    this.uiStep.set(LobbyUiStep.SignIn);
  }

  public beginWebcamPrimingIfEnabledAndSecure(): void {
    if (!this.gameSettings.webcamEnabled()) {
      return;
    }
    if (typeof globalThis.isSecureContext === 'boolean' && !globalThis.isSecureContext) {
      return;
    }
    this.liveKit.beginLocalVideoCaptureFromUserGesture();
  }

  public onWebcamEnabledChange(inputChecked: boolean): void {
    this.gameSettings.setWebcamEnabled(inputChecked);
    if (inputChecked) {
      this.beginWebcamPrimingIfEnabledAndSecure();
    } else {
      void this.liveKit.abandonPrimedLocalVideoCapture();
    }
  }

  private blockLobbyJoinIfWebcamRequiresSecureContext(): boolean {
    if (!this.gameSettings.webcamEnabled()) {
      return true;
    }
    if (typeof globalThis.isSecureContext === 'boolean' && !globalThis.isSecureContext) {
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Error,
        this.translate.instant(marker('shell.webcamInsecureContext')),
      );
      return false;
    }
    return true;
  }

  private connectLiveKitInBackground(credentials: LiveKitCredentialsPayload): void {
    void this.liveKit.connect(credentials).catch(() => {
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Info,
        this.translate.instant(marker('shell.liveKitConnectFailed')),
      );
    });
  }

  private async runStartSession(normalizedDisplayName: string): Promise<void> {
    this.beginWebcamPrimingIfEnabledAndSecure();
    let sid = this.playerSession.sessionId();
    if (sid.length === 0) {
      await this.playerSession.ensureReady();
      sid = this.playerSession.sessionId();
    }
    if (sid.length === 0) {
      const failureCode = this.playerSession.failureCode();
      const message =
        failureCode !== null
          ? userFacingErrorMessageFromCode(this.translate, failureCode)
          : this.translate.instant(marker('shell.sessionStartFailed'));
      this.shellFeedback.setFeedback(UiFeedbackTone.Error, message);
      return;
    }
    this.sessionState.set({ displayName: normalizedDisplayName, sessionId: sid });
    this.uiStep.set(LobbyUiStep.JoinLobby);
    this.shellFeedback.setFeedback(
      UiFeedbackTone.Success,
      this.translate.instant(marker('shell.welcomeNamed'), {
        userName: normalizedDisplayName,
      }),
    );
  }

  private async runJoinLobby(
    session: SessionUiState | null,
    lobbyCodeInput: string,
  ): Promise<void> {
    if (session === null) {
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Error,
        this.translate.instant(marker('shell.sessionMissing')),
      );
      this.uiStep.set(LobbyUiStep.SignIn);
      return;
    }
    if (!isLobbyCodeValid(lobbyCodeInput)) {
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Error,
        this.translate.instant(marker('shell.lobbyCodeTooShortRun')),
      );
      return;
    }
    if (!this.blockLobbyJoinIfWebcamRequiresSecureContext()) {
      return;
    }
    this.joinInProgress.set(true);
    this.shellFeedback.setFeedback(
      UiFeedbackTone.Info,
      this.translate.instant(marker('shell.joinConnecting'), {
        lobbyCode: lobbyCodeInput,
      }),
    );
    try {
      const joined = await this.gameState.joinLobby(lobbyCodeInput, session.displayName);
      this.uiStep.set(LobbyUiStep.Lobby);
      this.joinInProgress.set(false);
      const joinedKey =
        joined.lobbyIdleRecycled === true
          ? marker('shell.joinSuccessRecycledStaleLobby')
          : marker('shell.joinSuccess');
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Success,
        this.translate.instant(joinedKey, {
          lobbyCode: joined.lobbyCode,
        }),
      );
      if (joined.liveKit !== undefined) {
        this.connectLiveKitInBackground(joined.liveKit);
      }
    } catch (error: unknown) {
      void this.liveKit.abandonPrimedLocalVideoCapture();
      void this.liveKit.disconnect();
      this.gameState.disconnectLobby();
      this.joinInProgress.set(false);
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Error,
        this.resolveLobbyFlowFailureMessage(error, marker('shell.joinFailed'), lobbyCodeInput),
      );
    }
  }

  private async runCreateLobby(
    session: SessionUiState | null,
    lobbyCodeInput: string,
  ): Promise<void> {
    if (session === null) {
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Error,
        this.translate.instant(marker('shell.sessionMissing')),
      );
      this.uiStep.set(LobbyUiStep.SignIn);
      return;
    }
    if (!isLobbyCodeValid(lobbyCodeInput)) {
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Error,
        this.translate.instant(marker('shell.lobbyCodeTooShortRun')),
      );
      return;
    }
    if (!this.blockLobbyJoinIfWebcamRequiresSecureContext()) {
      return;
    }
    this.joinInProgress.set(true);
    this.shellFeedback.setFeedback(
      UiFeedbackTone.Info,
      this.translate.instant(marker('shell.createConnecting'), {
        lobbyCode: lobbyCodeInput,
      }),
    );
    try {
      const joined = await this.gameState.createLobby(lobbyCodeInput, session.displayName);
      this.uiStep.set(LobbyUiStep.Lobby);
      this.joinInProgress.set(false);
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Success,
        this.translate.instant(marker('shell.createSuccess'), {
          lobbyCode: joined.lobbyCode,
        }),
      );
      if (joined.liveKit !== undefined) {
        this.connectLiveKitInBackground(joined.liveKit);
      }
    } catch (error: unknown) {
      void this.liveKit.abandonPrimedLocalVideoCapture();
      void this.liveKit.disconnect();
      this.gameState.disconnectLobby();
      this.joinInProgress.set(false);
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Error,
        this.resolveLobbyFlowFailureMessage(error, marker('shell.createFailed'), lobbyCodeInput),
      );
    }
  }

  private resolveLobbyFlowFailureMessage(
    error: unknown,
    fallbackKey: string,
    lobbyCode: string,
  ): string {
    return resolveUserFacingErrorMessage(this.translate, error, fallbackKey, { lobbyCode });
  }
}
