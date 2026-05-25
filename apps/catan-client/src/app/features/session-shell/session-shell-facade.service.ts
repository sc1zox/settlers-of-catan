import { computed, inject, Injectable } from '@angular/core';
import { ResourceType } from '@catan/api-interfaces';
import { GameStateResource } from '../../core/game/game-state.resource';
import { DevCardsService } from '../dev-cards/dev-cards.service';
import { UiFeedbackTone } from '../lobby-game-ui/lobby-ui-state';
import { LobbyShellGameUiService } from '../lobby-game-ui/lobby-shell-game-ui.service';
import { LobbyDepartedFeedService } from '../shell-feedback/lobby-departed-feed.service';
import { ShellFeedbackService } from '../shell-feedback/shell-feedback.service';
import { SpectatorCameraService } from '../spectator-camera/spectator-camera.service';
import { SessionLobbyFlowService } from './session-lobby-flow.service';
import { SessionBuildInteractionService } from './session-build-interaction.service';
import { SessionRobberFlowService } from './session-robber-flow.service';
import { SessionTradingPanelService } from './session-trading-panel.service';
import { SessionDevCardOverlayService } from './session-dev-card-overlay.service';

@Injectable()
export class SessionShellFacadeService {
  private readonly gameState = inject(GameStateResource);

  public readonly lobbyFlow = inject(SessionLobbyFlowService);
  public readonly buildFlow = inject(SessionBuildInteractionService);
  public readonly robberFlow = inject(SessionRobberFlowService);
  public readonly tradingPanel = inject(SessionTradingPanelService);
  public readonly devOverlay = inject(SessionDevCardOverlayService);
  public readonly lobbyGameUi = inject(LobbyShellGameUiService);
  public readonly devCards = inject(DevCardsService);
  public readonly shellFeedback = inject(ShellFeedbackService);
  public readonly lobbyDepartedFeed = inject(LobbyDepartedFeedService);
  public readonly spectatorCamService = inject(SpectatorCameraService);

  public readonly robberMode = computed<boolean>(
    () => this.lobbyGameUi.canMoveRobber() || this.robberFlow.knightActive(),
  );

  public readonly uiFeedbackToneEnum = UiFeedbackTone;

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

  public rollDice(): void {
    if (!this.lobbyGameUi.canRollDice()) {
      return;
    }
    this.gameState.rollDice();
  }

  public finishTrading(): void {
    if (!this.lobbyGameUi.canFinishTrading()) {
      return;
    }
    this.tradingPanel.finishTrading();
  }

  public endTurn(): void {
    if (!this.lobbyGameUi.canEndTurn()) {
      return;
    }
    this.gameState.endTurn();
  }

  public buyDevCard(): void {
    if (!this.devCards.canBuyDevCard()) {
      return;
    }
    this.gameState.buyDevCard();
  }

  public onSubmitDiscard(discard: Readonly<Record<ResourceType, number>>): void {
    this.gameState.submitRobberDiscard(discard);
  }
}
