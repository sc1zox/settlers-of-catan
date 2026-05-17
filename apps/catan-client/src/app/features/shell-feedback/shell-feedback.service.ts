import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActionRejectedPayload } from '@catan/api-interfaces';
import { TranslateService } from '@ngx-translate/core';
import { GameSocketService } from '../../core/socket/game-socket.service';
import { UiFeedbackState, UiFeedbackTone } from '../lobby-game-ui/lobby-ui-state';
import { actionRejectMessage } from './action-reject';

@Injectable({ providedIn: 'root' })
export class ShellFeedbackService {
  private readonly sockets = inject(GameSocketService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private errorDismissHandle: ReturnType<typeof setTimeout> | null = null;
  private infoSuccessDismissHandle: ReturnType<typeof setTimeout> | null = null;

  public readonly feedback = signal<UiFeedbackState | null>(null);

  public constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.errorDismissHandle !== null) {
        clearTimeout(this.errorDismissHandle);
        this.errorDismissHandle = null;
      }
      if (this.infoSuccessDismissHandle !== null) {
        clearTimeout(this.infoSuccessDismissHandle);
        this.infoSuccessDismissHandle = null;
      }
    });
    this.sockets.actionRejected$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((payload: ActionRejectedPayload) => {
        this.setFeedback(UiFeedbackTone.Error, actionRejectMessage(this.translate, payload));
      });
  }

  public setFeedback(tone: UiFeedbackTone, message: string): void {
    if (this.errorDismissHandle !== null) {
      clearTimeout(this.errorDismissHandle);
      this.errorDismissHandle = null;
    }
    if (this.infoSuccessDismissHandle !== null) {
      clearTimeout(this.infoSuccessDismissHandle);
      this.infoSuccessDismissHandle = null;
    }
    this.feedback.set({ tone, message });
    const snapshotMessage = message;
    const snapshotTone = tone;
    if (tone === UiFeedbackTone.Error) {
      this.errorDismissHandle = setTimeout(() => {
        this.errorDismissHandle = null;
        const current = this.feedback();
        if (
          current !== null &&
          current.tone === UiFeedbackTone.Error &&
          current.message === snapshotMessage
        ) {
          this.feedback.set(null);
        }
      }, 2000);
    }
    if (tone === UiFeedbackTone.Info || tone === UiFeedbackTone.Success) {
      this.infoSuccessDismissHandle = setTimeout(() => {
        this.infoSuccessDismissHandle = null;
        const current = this.feedback();
        if (
          current !== null &&
          current.message === snapshotMessage &&
          current.tone === snapshotTone
        ) {
          this.feedback.set(null);
        }
      }, 10000);
    }
  }

  public clearFeedback(): void {
    if (this.errorDismissHandle !== null) {
      clearTimeout(this.errorDismissHandle);
      this.errorDismissHandle = null;
    }
    if (this.infoSuccessDismissHandle !== null) {
      clearTimeout(this.infoSuccessDismissHandle);
      this.infoSuccessDismissHandle = null;
    }
    this.feedback.set(null);
  }
}
