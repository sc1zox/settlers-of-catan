import { GamePhase, PlayerSeat } from '@catan/api-interfaces';
import { LobbyUiState } from '../../types/lobby-ui-state';

export function computeHudGameplayLocked(ui: LobbyUiState | null, isSelfTurn: boolean): boolean {
  if (ui === null) {
    return true;
  }
  const phase = ui.phase;
  if (phase === GamePhase.LobbyWaiting || phase === GamePhase.Finished || phase === GamePhase.Summary) {
    return true;
  }
  if (phase === GamePhase.RobberDiscard) {
    return true;
  }
  return !isSelfTurn;
}

export function computeHudRobberDiscardSelf(
  ui: LobbyUiState | null,
  selfSeat: PlayerSeat | null,
): boolean {
  if (ui === null || selfSeat === null) {
    return false;
  }
  return ui.phase === GamePhase.RobberDiscard && ui.pendingRobberDiscardSeats.includes(selfSeat);
}

export function computeHudShowPassiveWait(
  hudGameplayLocked: boolean,
  hudRobberDiscardSelf: boolean,
  phase: GamePhase | undefined,
): boolean {
  if (!hudGameplayLocked) {
    return false;
  }
  if (hudRobberDiscardSelf) {
    return false;
  }
  if (phase === GamePhase.Finished || phase === GamePhase.Summary) {
    return false;
  }
  return true;
}

export function computeHudChromeSpectatorPaused(
  hudGameplayLocked: boolean,
  hudRobberDiscardSelf: boolean,
): boolean {
  return hudGameplayLocked && !hudRobberDiscardSelf;
}
