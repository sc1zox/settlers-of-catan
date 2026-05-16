import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  DefaultDisplayName,
  ResourceType,
} from '@catan/api-interfaces';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { GameStateResource } from '../../core/game/game-state.resource';
import { GameSettingsService } from '../game-settings/game-settings.service';
import { BuildConfirmPopoverComponent } from '../../game-canvas/build-confirm-popover';
import { DiscardModalComponent } from '../../game-canvas/discard-modal';
import { DevCardModalComponent } from '../dev-cards/dev-card-modal';
import { DevCardsService } from '../dev-cards/dev-cards.service';
import { GameCanvasComponent } from '../../game-canvas/game-canvas';
import { RobberVictimPopoverComponent } from '../../game-canvas/robber-victim-popover';
import { TradePanelComponent } from '../trading/trade-panel.component';
import { LobbyUiStep, UiFeedbackTone } from '../../shared/types/lobby-ui-state';
import { LobbyShellGameUiService } from '../lobby-game-ui/lobby-shell-game-ui.service';
import { ShellFeedbackService } from '../shell-feedback/shell-feedback.service';
import { SpectatorCameraService } from '../spectator-camera/spectator-camera.service';
import { GameSettingsToggle } from '../game-settings/game-settings-toggle';
import { SpectatorCameraToggle } from '../spectator-camera/spectator-camera-toggle';
import { SessionLobbyFlowService } from './session-lobby-flow.service';
import { SessionBuildInteractionService } from './session-build-interaction.service';
import { SessionRobberFlowService } from './session-robber-flow.service';
import { SessionTradingPanelService } from './session-trading-panel.service';
import { SessionDevCardOverlayService } from './session-dev-card-overlay.service';

@Component({
  selector: 'app-session-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    GameCanvasComponent,
    ReactiveFormsModule,
    BuildConfirmPopoverComponent,
    DiscardModalComponent,
    DevCardModalComponent,
    TradePanelComponent,
    RobberVictimPopoverComponent,
    SpectatorCameraToggle,
    GameSettingsToggle,
    TranslatePipe,
  ],
  templateUrl: './session-shell.html',
  styleUrl: './session-shell.scss',
  providers: [
    SessionLobbyFlowService,
    SessionBuildInteractionService,
    SessionRobberFlowService,
    SessionTradingPanelService,
    SessionDevCardOverlayService,
  ],
})
export class SessionShell {
  private readonly fb = inject(FormBuilder);
  private readonly gameState = inject(GameStateResource);
  public readonly lobbyFlow = inject(SessionLobbyFlowService);
  public readonly buildFlow = inject(SessionBuildInteractionService);
  public readonly robberFlow = inject(SessionRobberFlowService);
  public readonly tradingPanel = inject(SessionTradingPanelService);
  public readonly devOverlay = inject(SessionDevCardOverlayService);
  public readonly lobbyGameUi = inject(LobbyShellGameUiService);
  public readonly devCards = inject(DevCardsService);
  public readonly shellFeedback = inject(ShellFeedbackService);
  public readonly gameSettings = inject(GameSettingsService);
  public readonly spectatorCamService = inject(SpectatorCameraService);
  private readonly translate = inject(TranslateService);

  public readonly sessionForm = this.fb.nonNullable.group({
    displayName: this.fb.nonNullable.control<string>(DefaultDisplayName.PlayerDe, {
      validators: [Validators.required, Validators.minLength(2)],
    }),
  });
  public readonly lobbyForm = this.fb.nonNullable.group({
    lobbyCode: this.fb.nonNullable.control<string>('catan-runde', {
      validators: [Validators.required, Validators.minLength(2)],
    }),
  });

  public readonly robberMode = computed<boolean>(
    () => this.lobbyGameUi.canMoveRobber() || this.robberFlow.knightActive(),
  );

  private readonly exploreModeUiReset = effect(() => {
    if (!this.spectatorCamService.mode()) {
      return;
    }
    this.buildFlow.resetForSpectatorMode();
    this.robberFlow.resetForSpectatorMode();
    this.tradingPanel.resetForSpectatorMode();
    this.devOverlay.resetForSpectatorMode();
  });

  public readonly lobbyUiStep = LobbyUiStep;
  public readonly uiFeedbackTone = UiFeedbackTone;

  public lobbyCodeValue(): string {
    return this.lobbyForm.controls.lobbyCode.value;
  }

  public activeLobbyCode(): string {
    return (
      this.lobbyGameUi.lobbyUiState()?.lobbyCode ??
      this.gameState.connection()?.lobbyCode ??
      this.lobbyCodeValue()
    );
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
