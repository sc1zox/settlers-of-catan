import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { isLobbyCodeValid } from '@catan/api-interfaces';
import { ClientStorageKey } from '../../../shared/client-constants';
import { GameStateResource } from '../../core/game/game-state.resource';
import { GameSocketService } from '../../core/socket/game-socket.service';
import { LobbyLiveKitService } from '../webcam-head/lobby-livekit.service';
import { ShellFeedbackService } from '../shell-feedback/shell-feedback.service';
import { UiFeedbackTone } from '../lobby-game-ui/lobby-ui-state';
import { resolveUserFacingErrorMessage } from '../shell-feedback/user-facing-error';

@Component({
  selector: 'app-join-lobby',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './join-lobby.html',
  styleUrl: './join-lobby.scss',
})
export class JoinLobby {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly gameState = inject(GameStateResource);
  private readonly sockets = inject(GameSocketService);
  private readonly liveKit = inject(LobbyLiveKitService);
  private readonly translate = inject(TranslateService);
  private readonly shellFeedback = inject(ShellFeedbackService);

  public readonly lobbyForm = this.fb.nonNullable.group({
    lobbyCode: this.fb.nonNullable.control<string>('', {
      validators: [Validators.required, Validators.minLength(2)],
    }),
  });

  public readonly joinInProgress = signal<boolean>(false);
  public readonly feedback = this.shellFeedback.feedback;
  public readonly feedbackToneEnum = UiFeedbackTone;

  public displayName(): string {
    try {
      return localStorage.getItem(ClientStorageKey.DisplayName) ?? '';
    } catch {
      return '';
    }
  }

  public joinLobby(): void {
    if (this.lobbyForm.invalid) {
      this.lobbyForm.markAllAsTouched();
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Error,
        this.translate.instant(marker('shell.lobbyCodeTooShort')),
      );
      return;
    }
    void this.runJoinLobby(this.lobbyForm.controls.lobbyCode.value.trim());
  }

  public createLobby(): void {
    if (this.lobbyForm.invalid) {
      this.lobbyForm.markAllAsTouched();
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Error,
        this.translate.instant(marker('shell.lobbyCodeTooShort')),
      );
      return;
    }
    void this.runCreateLobby(this.lobbyForm.controls.lobbyCode.value.trim());
  }

  public backToSignIn(): void {
    void this.liveKit.abandonPrimedLocalVideoCapture();
    this.shellFeedback.setFeedback(
      UiFeedbackTone.Info,
      this.translate.instant(marker('shell.backToSignIn')),
    );
    void this.router.navigate(['/sign-in']);
  }

  private async runJoinLobby(lobbyCodeInput: string): Promise<void> {
    const displayName = this.displayName();
    if (displayName.length === 0) {
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Error,
        this.translate.instant(marker('shell.sessionMissing')),
      );
      void this.router.navigate(['/sign-in']);
      return;
    }
    if (!isLobbyCodeValid(lobbyCodeInput)) {
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Error,
        this.translate.instant(marker('shell.lobbyCodeTooShortRun')),
      );
      return;
    }
    if (this.liveKit.canJoinWithWebcam() === 'insecureContext') {
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Error,
        this.translate.instant(marker('shell.webcamInsecureContext')),
      );
      return;
    }
    this.joinInProgress.set(true);
    this.shellFeedback.setFeedback(
      UiFeedbackTone.Info,
      this.translate.instant(marker('shell.joinConnecting'), { lobbyCode: lobbyCodeInput }),
    );
    try {
      const joined = await this.gameState.joinLobby(lobbyCodeInput, displayName);
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
      void this.router.navigate(['/lobby', joined.lobbyCode]);
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
          { lobbyCode: lobbyCodeInput },
        ),
      );
    }
  }

  private async runCreateLobby(lobbyCodeInput: string): Promise<void> {
    const displayName = this.displayName();
    if (displayName.length === 0) {
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Error,
        this.translate.instant(marker('shell.sessionMissing')),
      );
      void this.router.navigate(['/sign-in']);
      return;
    }
    if (!isLobbyCodeValid(lobbyCodeInput)) {
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Error,
        this.translate.instant(marker('shell.lobbyCodeTooShortRun')),
      );
      return;
    }
    if (this.liveKit.canJoinWithWebcam() === 'insecureContext') {
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Error,
        this.translate.instant(marker('shell.webcamInsecureContext')),
      );
      return;
    }
    this.joinInProgress.set(true);
    this.shellFeedback.setFeedback(
      UiFeedbackTone.Info,
      this.translate.instant(marker('shell.createConnecting'), { lobbyCode: lobbyCodeInput }),
    );
    try {
      const joined = await this.gameState.createLobby(lobbyCodeInput, displayName);
      this.joinInProgress.set(false);
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Success,
        this.translate.instant(marker('shell.createSuccess'), { lobbyCode: joined.lobbyCode }),
      );
      if (joined.liveKit !== undefined) {
        void this.liveKit.connect(joined.liveKit).catch(() => {
          this.shellFeedback.setFeedback(
            UiFeedbackTone.Info,
            this.translate.instant(marker('shell.liveKitConnectFailed')),
          );
        });
      }
      void this.router.navigate(['/lobby', joined.lobbyCode]);
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
          marker('shell.createFailed'),
          { lobbyCode: lobbyCodeInput },
        ),
      );
    }
  }
}
