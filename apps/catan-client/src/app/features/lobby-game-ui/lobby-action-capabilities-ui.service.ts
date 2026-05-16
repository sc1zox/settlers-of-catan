import { computed, inject, Injectable } from '@angular/core';
import { GamePhase } from '@catan/api-interfaces';
import { LobbyGameUiStateService } from './lobby-game-ui-state.service';
import { LobbyTradeUiService } from './lobby-trade-ui.service';

@Injectable({ providedIn: 'root' })
export class LobbyActionCapabilitiesUiService {
  private readonly state = inject(LobbyGameUiStateService);
  private readonly tradeUi = inject(LobbyTradeUiService);

  private readonly setupPendingRoadVertexId = computed<string | null>(() => {
    const lobbyUi = this.state.lobbyUiState();
    const seat = this.state.selfSeat();
    if (lobbyUi === null || seat === null || lobbyUi.pendingSetupRoadSeat !== seat) {
      return null;
    }
    return lobbyUi.pendingSetupRoadFromVertexId;
  });

  public readonly canStartLobby = computed<boolean>(
    () => this.state.isLobbyAdmin() && this.state.lobbyUiState()?.phase === GamePhase.LobbyWaiting,
  );

  public readonly canFillLobbyWithBots = computed<boolean>(() => {
    const lobbyUi = this.state.lobbyUiState();
    const raw = this.state.rawLobbyState();
    if (!this.state.isLobbyAdmin() || lobbyUi === null || raw === undefined) {
      return false;
    }
    return lobbyUi.phase === GamePhase.LobbyWaiting && raw.players.length < 4;
  });

  public readonly canRollDice = computed<boolean>(
    () => this.state.isSelfTurn() && this.state.lobbyUiState()?.phase === GamePhase.Rolling,
  );

  public readonly canFinishTrading = computed<boolean>(
    () => this.state.isSelfTurn() && this.state.lobbyUiState()?.phase === GamePhase.Trading,
  );

  public readonly canEndTurn = computed<boolean>(
    () => this.state.isSelfTurn() && this.state.lobbyUiState()?.phase === GamePhase.Building,
  );

  /** True when the user can compose a fresh proposal (their turn in Trading). */
  public readonly canComposeNewTrade = computed<boolean>(
    () => this.state.isSelfTurn() && this.state.lobbyUiState()?.phase === GamePhase.Trading,
  );

  /**
   * True when the HUD Trade button should be visible. Includes receivers of
   * an open offer so they can re-open the panel after dismissing it.
   */
  public readonly canOpenTrade = computed<boolean>(
    () => this.canComposeNewTrade() || this.tradeUi.selfHasOpenTrade(),
  );

  public readonly canMoveRobber = computed<boolean>(
    () => this.state.isSelfTurn() && this.state.lobbyUiState()?.phase === GamePhase.RobberMove,
  );

  public readonly canBuildSettlement = computed<boolean>(() => {
    const lobbyUi = this.state.lobbyUiState();
    const seat = this.state.selfSeat();
    if (lobbyUi === null) {
      return false;
    }
    const setupPendingForSelf =
      seat !== null &&
      lobbyUi.pendingSetupRoadSeat === seat &&
      lobbyUi.pendingSetupRoadFromVertexId !== null;
    return (
      this.state.isSelfTurn() &&
      (lobbyUi.phase === GamePhase.Building ||
        ((lobbyUi.phase === GamePhase.SetupForward || lobbyUi.phase === GamePhase.SetupBackward) &&
          !setupPendingForSelf))
    );
  });

  public readonly canBuildRoad = computed<boolean>(() => {
    const lobbyUi = this.state.lobbyUiState();
    if (lobbyUi === null || !this.state.isSelfTurn()) {
      return false;
    }
    if (lobbyUi.phase === GamePhase.Building) {
      return true;
    }
    if (lobbyUi.phase === GamePhase.SetupForward || lobbyUi.phase === GamePhase.SetupBackward) {
      return this.setupPendingRoadVertexId() !== null;
    }
    return false;
  });

  public readonly canBuildCity = computed<boolean>(() => this.canEndTurn());
}
