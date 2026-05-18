import { DestroyRef, effect, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { GamePhase } from '@catan/api-interfaces';
import { GameStateResource } from '../../core/game/game-state.resource';
import { GameSocketService } from '../../core/socket/game-socket.service';
import { LobbyShellGameUiService } from '../lobby-game-ui/lobby-shell-game-ui.service';
import { LobbyTradeUiService } from '../lobby-game-ui/lobby-trade-ui.service';
import { SpectatorCameraService } from '../spectator-camera/spectator-camera.service';
import { SessionBuildInteractionService } from './session-build-interaction.service';
import { SessionDevCardOverlayService } from './session-dev-card-overlay.service';
import { SessionRobberFlowService } from './session-robber-flow.service';
import { SessionTradingPanelService } from './session-trading-panel.service';

/**
 * Single owner of "when to wipe local UI state" for the session shell. The
 * feature services only know how to reset themselves (`resetSession()`);
 * all lifecycle decisions live here, so a new trigger lands in one file and
 * a new feature is one extra `resetSession()` call.
 *
 * Triggers:
 *  - lobby code rotates (leave, hop, kick) → wipe every overlay
 *  - spectator camera activates            → wipe every overlay
 *  - game phase rotates                    → wipe interaction modes
 *    (build/robber) so a leftover ghost doesn't survive into the next phase
 *  - server rejects an action              → same, the optimistic mode was
 *    bogus and the user shouldn't be stuck in it
 *
 * The render layer follows server FullState directly and needs no help here.
 */
@Injectable()
export class SessionCleanupService {
  private readonly gameState = inject(GameStateResource);
  private readonly sockets = inject(GameSocketService);
  private readonly lobbyGameUi = inject(LobbyShellGameUiService);
  private readonly spectator = inject(SpectatorCameraService);
  private readonly tradeUi = inject(LobbyTradeUiService);
  private readonly tradingPanel = inject(SessionTradingPanelService);
  private readonly buildFlow = inject(SessionBuildInteractionService);
  private readonly robberFlow = inject(SessionRobberFlowService);
  private readonly devOverlay = inject(SessionDevCardOverlayService);
  private readonly destroyRef = inject(DestroyRef);

  public constructor() {
    let previousLobbyCode = '';
    effect(() => {
      const params = this.gameState.subscriptionParams();
      const currentLobbyCode = params?.lobbyCode ?? '';
      if (previousLobbyCode !== '' && previousLobbyCode !== currentLobbyCode) {
        this.resetAll();
      }
      previousLobbyCode = currentLobbyCode;
    });

    effect(() => {
      if (this.spectator.mode()) {
        this.resetAll();
      }
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
      .subscribe(() => this.resetInteractionModes());
  }

  private resetAll(): void {
    this.tradeUi.resetSession();
    this.tradingPanel.resetSession();
    this.buildFlow.resetSession();
    this.robberFlow.resetSession();
    this.devOverlay.resetSession();
  }

  private resetInteractionModes(): void {
    this.buildFlow.resetSession();
    this.robberFlow.resetSession();
  }
}
