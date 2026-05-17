import { computed, DestroyRef, effect, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { DefaultDisplayName, GamePhase, ResourceType } from '@catan/api-interfaces';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslateService } from '@ngx-translate/core';
import { GameStateResource } from '../../core/game/game-state.resource';
import { GameSettingsService } from '../game-settings/game-settings.service';
import { DevCardsService } from '../dev-cards/dev-cards.service';
import { LobbyUiStep, UiFeedbackTone } from '../lobby-game-ui/lobby-ui-state';
import { LobbyShellGameUiService } from '../lobby-game-ui/lobby-shell-game-ui.service';
import { LobbyDepartedFeedService } from '../shell-feedback/lobby-departed-feed.service';
import { ShellFeedbackService } from '../shell-feedback/shell-feedback.service';
import { SpectatorCameraService } from '../spectator-camera/spectator-camera.service';
import { SessionLobbyFlowService } from './session-lobby-flow.service';
import { SessionBuildInteractionService } from './session-build-interaction.service';
import { SessionRobberFlowService } from './session-robber-flow.service';
import { SessionTradingPanelService } from './session-trading-panel.service';
import { SessionDevCardOverlayService } from './session-dev-card-overlay.service';
import { GameSocketService } from '../../core/socket/game-socket.service';

@Injectable()
export class SessionShellFacadeService {
  private readonly fb = inject(FormBuilder);
  private readonly gameState = inject(GameStateResource);
  private readonly translate = inject(TranslateService);

  public readonly lobbyFlow = inject(SessionLobbyFlowService);
  public readonly buildFlow = inject(SessionBuildInteractionService);
  public readonly robberFlow = inject(SessionRobberFlowService);
  public readonly tradingPanel = inject(SessionTradingPanelService);
  public readonly devOverlay = inject(SessionDevCardOverlayService);
  public readonly lobbyGameUi = inject(LobbyShellGameUiService);
  public readonly devCards = inject(DevCardsService);
  public readonly shellFeedback = inject(ShellFeedbackService);
  public readonly lobbyDepartedFeed = inject(LobbyDepartedFeedService);
  public readonly gameSettings = inject(GameSettingsService);
  public readonly spectatorCamService = inject(SpectatorCameraService);
  private readonly sockets = inject(GameSocketService);
  private readonly destroyRef = inject(DestroyRef);

  public readonly sessionForm = this.fb.nonNullable.group({
    displayName: this.fb.nonNullable.control<string>(DefaultDisplayName.PlayerDe, {
      validators: [Validators.required, Validators.minLength(2)],
    }),
  });
  public readonly lobbyForm = this.fb.nonNullable.group({
    lobbyCode: this.fb.nonNullable.control<string>('', {
      validators: [Validators.required, Validators.minLength(2)],
    }),
  });

  public readonly robberMode = computed<boolean>(
    () => this.lobbyGameUi.canMoveRobber() || this.robberFlow.knightActive(),
  );

  public readonly lobbyUiStepEnum = LobbyUiStep;
  public readonly uiFeedbackToneEnum = UiFeedbackTone;

  public constructor() {
    effect(() => {
      if (!this.spectatorCamService.mode()) {
        return;
      }
      this.buildFlow.resetForSpectatorMode();
      this.robberFlow.resetForSpectatorMode();
      this.tradingPanel.resetForSpectatorMode();
      this.devOverlay.resetForSpectatorMode();
    });
    // Whenever the active lobby changes (leave, hop, or kick), wipe any UI
    // overlay state that was bound to the previous lobby. The render layer
    // already follows the server FullState; this is the same guarantee for
    // local mode signals (build mode, robber pick, trade panel, dev-card
    // overlay) so a fresh lobby always starts with a clean UI.
    let previousLobbyCode = '';
    effect(() => {
      const params = this.gameState.subscriptionParams();
      const currentLobbyCode = params?.lobbyCode ?? '';
      if (previousLobbyCode !== '' && previousLobbyCode !== currentLobbyCode) {
        this.buildFlow.resetForLobbyLeave();
        this.robberFlow.resetForLobbyLeave();
        this.tradingPanel.resetForLobbyLeave();
        this.devOverlay.resetForLobbyLeave();
      }
      previousLobbyCode = currentLobbyCode;
    });
    let previousPhase: GamePhase | undefined;
    effect(() => {
      const phase = this.lobbyGameUi.lobbyUiState()?.phase;
      if (phase === undefined) {
        previousPhase = undefined;
        return;
      }
      if (previousPhase !== undefined && previousPhase !== phase) {
        this.resetInteractionModes();
      }
      previousPhase = phase;
    });
    this.sockets.actionRejected$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.resetInteractionModes();
      });
  }

  private resetInteractionModes(): void {
    this.buildFlow.resetForLobbyLeave();
    this.robberFlow.resetForLobbyLeave();
  }

  public lobbyCodeValue(): string {
    return this.lobbyForm.controls.lobbyCode.value;
  }

  public startSession(): void {
    if (this.sessionForm.invalid) {
      this.sessionForm.markAllAsTouched();
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Error,
        this.translate.instant(marker('shell.nameTooShort')),
      );
      return;
    }
    this.lobbyFlow.submitStartSession(this.sessionForm.controls.displayName.value.trim());
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
    this.lobbyFlow.submitJoinLobby(
      this.lobbyFlow.sessionState(),
      this.lobbyForm.controls.lobbyCode.value.trim(),
    );
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
    this.lobbyFlow.submitCreateLobby(
      this.lobbyFlow.sessionState(),
      this.lobbyForm.controls.lobbyCode.value.trim(),
    );
  }

  public onWebcamEnabledChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.lobbyFlow.onWebcamEnabledChange(input.checked);
  }

  public startLobby(): void {
    this.gameState.startLobby();
  }

  public fillLobbyWithBots(): void {
    this.gameState.fillLobbyWithBots();
  }

  public rollDice(): void {
    if (!this.lobbyGameUi.canRollDice()) {
      return;
    }
    this.gameState.rollDice();
  }

  public finishTrading(): void {
    this.tradingPanel.finishTrading();
  }

  public endTurn(): void {
    this.gameState.endTurn();
  }

  public buyDevCard(): void {
    this.gameState.buyDevCard();
  }

  public onSubmitDiscard(discard: Readonly<Record<ResourceType, number>>): void {
    this.gameState.submitRobberDiscard(discard);
  }
}
