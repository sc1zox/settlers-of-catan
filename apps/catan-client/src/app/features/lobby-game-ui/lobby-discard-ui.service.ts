import { computed, inject, Injectable } from '@angular/core';
import { GamePhase } from '@catan/api-interfaces';
import { DiscardModalModel } from '../../game-canvas/discard-modal';
import { totalResourceCards } from '../../shared/helper/lobby-game-ui/resource-card-totals';
import { LobbyGameUiStateService } from './lobby-game-ui-state.service';

@Injectable({ providedIn: 'root' })
export class LobbyDiscardUiService {
  private readonly state = inject(LobbyGameUiStateService);

  public readonly discardModel = computed<DiscardModalModel | null>(() => {
    const lobbyUi = this.state.lobbyUiState();
    const seat = this.state.selfSeat();
    const self = this.state.selfPlayer();
    if (lobbyUi === null || seat === null || self === undefined) {
      return null;
    }
    if (lobbyUi.phase !== GamePhase.RobberDiscard) {
      return null;
    }
    if (!lobbyUi.pendingRobberDiscardSeats.includes(seat)) {
      return null;
    }
    const total = totalResourceCards(self.resources);
    return { required: Math.floor(total / 2), handCounts: self.resources };
  });
}
