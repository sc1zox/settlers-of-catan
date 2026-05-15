import { Injectable, computed, inject } from '@angular/core';
import { GamePhase } from '@catan/api-interfaces';
import { GameStateResource } from '../../core/game/game-state.resource';
import { LobbyShellGameUiService } from '../lobby-game-ui/lobby-shell-game-ui.service';

/**
 * Derived capability signals around development cards. Owns the rules the UI
 * needs to enable/disable the dev-card affordances:
 *   - it must be the viewer's turn (Trading or Building phase),
 *   - the player has at least one card that's been in hand since the start of
 *     the turn (cards drawn this turn are not yet playable), and
 *   - no other dev card has been played this turn (max one per turn).
 */
@Injectable({ providedIn: 'root' })
export class DevCardsService {
  private readonly gameState = inject(GameStateResource);
  private readonly lobbyUi = inject(LobbyShellGameUiService);

  public readonly devDeckCount = computed<number>(
    () => this.gameState.lobby.value()?.devDeckCount ?? 0,
  );

  public readonly canBuyDevCard = computed<boolean>(
    () => this.lobbyUi.canEndTurn() && this.devDeckCount() > 0,
  );

  public readonly canPlayDevCard = computed<boolean>(() => {
    if (!this.lobbyUi.isSelfTurn()) {
      return false;
    }
    const phase = this.lobbyUi.lobbyUiState()?.phase;
    if (phase !== GamePhase.Trading && phase !== GamePhase.Building) {
      return false;
    }
    const self = this.lobbyUi.selfPlayer();
    if (self === undefined) {
      return false;
    }
    if (self.hasPlayedDevCardThisTurn) {
      return false;
    }
    return self.devCardsInHand - self.devCardsBoughtThisTurn > 0;
  });
}
