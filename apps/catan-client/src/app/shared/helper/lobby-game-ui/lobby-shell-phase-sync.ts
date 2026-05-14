import { Injectable, WritableSignal } from '@angular/core';
import { GamePhase } from '@catan/api-interfaces';
import { LobbyUiState, LobbyUiStep, UiFeedbackTone } from '../../types/lobby-ui-state';

export enum LobbyShellPhaseSyncKind {
  None = 'NONE',
  ReturnToLobby = 'RETURN_TO_LOBBY',
  EnterInGame = 'ENTER_IN_GAME',
}

export interface LobbyShellPhaseSyncPlan {
  readonly kind: LobbyShellPhaseSyncKind;
  readonly feedback?: { readonly tone: UiFeedbackTone; readonly message: string };
}

export function planLobbyShellPhaseSync(params: {
  readonly uiStep: LobbyUiStep;
  readonly lobbyUiState: LobbyUiState | null;
}): LobbyShellPhaseSyncPlan {
  if (params.lobbyUiState === null) {
    return { kind: LobbyShellPhaseSyncKind.None };
  }
  const state = params.lobbyUiState;
  if (state.phase === GamePhase.LobbyWaiting) {
    if (params.uiStep === LobbyUiStep.InGame) {
      return { kind: LobbyShellPhaseSyncKind.ReturnToLobby };
    }
    return { kind: LobbyShellPhaseSyncKind.None };
  }
  if (params.uiStep !== LobbyUiStep.InGame) {
    return {
      kind: LobbyShellPhaseSyncKind.EnterInGame,
      feedback: { tone: UiFeedbackTone.Success, message: 'Spiel gestartet.' },
    };
  }
  return { kind: LobbyShellPhaseSyncKind.None };
}

@Injectable()
export class LobbyShellPhaseSyncService {
  public apply(
    uiStep: WritableSignal<LobbyUiStep>,
    lobbyUiState: LobbyUiState | null,
    setFeedback: (tone: UiFeedbackTone, message: string) => void,
  ): void {
    const plan = planLobbyShellPhaseSync({ uiStep: uiStep(), lobbyUiState });
    if (plan.kind === LobbyShellPhaseSyncKind.None) {
      return;
    }
    if (plan.kind === LobbyShellPhaseSyncKind.ReturnToLobby) {
      uiStep.set(LobbyUiStep.Lobby);
      return;
    }
    uiStep.set(LobbyUiStep.InGame);
    if (plan.feedback !== undefined) {
      setFeedback(plan.feedback.tone, plan.feedback.message);
    }
  }
}
