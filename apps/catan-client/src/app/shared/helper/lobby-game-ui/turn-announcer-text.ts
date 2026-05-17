import { GamePhase, LobbyFullStatePayload } from '@catan/api-interfaces';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslateInstantFn } from '../../../../shared/i18n/translate-instant-fn';
import { LobbyUiState, LobbyUiStep } from '../../types/lobby-ui-state';
import { robberDiscardDisplayNames } from './lobby-ui.mapper';

export function buildTurnAnnouncerText(
  params: {
    readonly uiStep: LobbyUiStep;
    readonly raw: LobbyFullStatePayload | undefined;
    readonly ui: LobbyUiState | null;
    readonly activeTurnPlayerName: string;
    readonly isSelfActiveTurn: boolean;
  },
  instant: TranslateInstantFn,
): string {
  if (params.uiStep !== LobbyUiStep.InGame) {
    return '';
  }
  const raw = params.raw;
  const ui = params.ui;
  if (raw === undefined || ui === null) {
    return '';
  }
  const active = params.activeTurnPlayerName;
  const selfTurn = params.isSelfActiveTurn;
  const phase = ui.phase;
  if (phase === GamePhase.LobbyWaiting) {
    return instant(marker('announcer.lobbyWaiting'));
  }
  if (phase === GamePhase.SetupForward) {
    if (selfTurn) {
      return instant(marker('announcer.setupForwardSelf'));
    }
    return instant(marker('announcer.setupForwardOther'), { activeName: active });
  }
  if (phase === GamePhase.SetupBackward) {
    if (selfTurn) {
      return instant(marker('announcer.setupBackwardSelf'));
    }
    return instant(marker('announcer.setupBackwardOther'), { activeName: active });
  }
  if (phase === GamePhase.Rolling) {
    if (selfTurn) {
      return instant(marker('announcer.rollingSelf'));
    }
    return instant(marker('announcer.rollingOther'), { activeName: active });
  }
  if (phase === GamePhase.RobberDiscard) {
    const names = robberDiscardDisplayNames(raw, ui, instant);
    if (names.length > 0) {
      const namesList = names.join(', ');
      return instant(marker('announcer.robberDiscardNamed'), { namesList });
    }
    return instant(marker('announcer.robberDiscardGeneric'));
  }
  if (phase === GamePhase.RobberMove) {
    if (selfTurn) {
      return instant(marker('announcer.robberMoveSelf'));
    }
    return instant(marker('announcer.robberMoveOther'), { activeName: active });
  }
  if (phase === GamePhase.Trading) {
    if (raw.lastDiceRoll !== null) {
      const diceSum = String(raw.lastDiceRoll.sum);
      if (selfTurn) {
        return instant(marker('announcer.tradingWithRollSelf'), { diceSum });
      }
      return instant(marker('announcer.tradingWithRollOther'), {
        activeName: active,
        diceSum,
      });
    }
    if (selfTurn) {
      return instant(marker('announcer.tradingSelf'));
    }
    return instant(marker('announcer.tradingOther'), { activeName: active });
  }
  if (phase === GamePhase.Building) {
    if (selfTurn) {
      return instant(marker('announcer.buildingSelf'));
    }
    return instant(marker('announcer.buildingOther'), { activeName: active });
  }
  if (phase === GamePhase.Finished || phase === GamePhase.Summary) {
    return '';
  }
  if (phase === GamePhase.EndTurn) {
    if (selfTurn) {
      return instant(marker('announcer.endTurnSelf'));
    }
    return instant(marker('announcer.endTurnOther'), { activeName: active });
  }
  if (selfTurn) {
    return instant(marker('announcer.defaultSelf'));
  }
  return instant(marker('announcer.defaultOther'), { activeName: active });
}
