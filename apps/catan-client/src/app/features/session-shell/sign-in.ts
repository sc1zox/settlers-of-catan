import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DefaultDisplayName } from '@catan/api-interfaces';
import { ClientStorageKey } from '../../../shared/client-constants';
import { PlayerSessionService } from '../../core/session/player-session.service';
import { GameSettingsService } from '../game-settings/game-settings.service';
import { LobbyLiveKitService } from '../webcam-head/lobby-livekit.service';
import { ShellFeedbackService } from '../shell-feedback/shell-feedback.service';
import { UiFeedbackTone } from '../lobby-game-ui/lobby-ui-state';
import {
  userFacingErrorMessageFromCode,
} from '../shell-feedback/user-facing-error';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './sign-in.html',
  styleUrl: './sign-in.scss',
})
export class SignIn {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly playerSession = inject(PlayerSessionService);
  private readonly liveKit = inject(LobbyLiveKitService);
  private readonly translate = inject(TranslateService);
  private readonly shellFeedback = inject(ShellFeedbackService);
  public readonly gameSettings = inject(GameSettingsService);

  public readonly sessionForm = this.fb.nonNullable.group({
    displayName: this.fb.nonNullable.control<string>(
      this.readStoredDisplayName() || DefaultDisplayName.PlayerDe,
      { validators: [Validators.required, Validators.minLength(2)] },
    ),
  });

  public readonly feedback = this.shellFeedback.feedback;
  public readonly feedbackToneEnum = UiFeedbackTone;

  public startSession(): void {
    if (this.sessionForm.invalid) {
      this.sessionForm.markAllAsTouched();
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Error,
        this.translate.instant(marker('shell.nameTooShort')),
      );
      return;
    }
    void this.runStartSession(this.sessionForm.controls.displayName.value.trim());
  }

  public onWebcamToggleClick(event: Event): void {
    event.preventDefault();
    this.liveKit.handleWebcamToggleUserGesture();
  }

  private async runStartSession(displayName: string): Promise<void> {
    this.liveKit.tryPrime();
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
    this.persistDisplayName(displayName);
    this.shellFeedback.setFeedback(
      UiFeedbackTone.Success,
      this.translate.instant(marker('shell.welcomeNamed'), { userName: displayName }),
    );
    void this.router.navigate(['/join']);
  }

  private persistDisplayName(displayName: string): void {
    try {
      localStorage.setItem(ClientStorageKey.DisplayName, displayName);
    } catch {
      // localStorage may be unavailable
    }
  }

  private readStoredDisplayName(): string {
    try {
      return localStorage.getItem(ClientStorageKey.DisplayName) ?? '';
    } catch {
      return '';
    }
  }
}
