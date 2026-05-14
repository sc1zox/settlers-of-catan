import { ActionRejectCode, ActionRejectedPayload } from '@catan/api-interfaces';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslateService } from '@ngx-translate/core';

const REJECT_KEY: Record<ActionRejectCode, string> = {
  [ActionRejectCode.WrongPhase]: 'reject.wrongPhase',
  [ActionRejectCode.NotYourTurn]: 'reject.notYourTurn',
  [ActionRejectCode.InsufficientResources]: 'reject.insufficientResources',
  [ActionRejectCode.IllegalPlacement]: 'reject.illegalPlacement',
  [ActionRejectCode.InvalidPayload]: 'reject.invalidPayload',
  [ActionRejectCode.LobbyFull]: 'reject.lobbyFull',
  [ActionRejectCode.UnknownLobby]: 'reject.unknownLobby',
  [ActionRejectCode.PlayerNotInLobby]: 'reject.playerNotInLobby',
  [ActionRejectCode.UnknownTrade]: 'reject.unknownTrade',
  [ActionRejectCode.TradeNotOpen]: 'reject.tradeNotOpen',
  [ActionRejectCode.NoDevCardAvailable]: 'reject.noDevCardAvailable',
  [ActionRejectCode.DevCardNotOwned]: 'reject.devCardNotOwned',
  [ActionRejectCode.InvalidBankTrade]: 'reject.invalidBankTrade',
  [ActionRejectCode.VictimRequired]: 'reject.victimRequired',
  [ActionRejectCode.GameFinished]: 'reject.gameFinished',
};

export function actionRejectMessage(
  translate: TranslateService,
  payload: ActionRejectedPayload,
): string {
  const key = REJECT_KEY[payload.code];
  const base = translate.instant(marker(key));
  const raw = payload.message.trim();
  if (raw.length === 0 || raw === payload.code) {
    return base;
  }
  return `${base} — ${raw}`;
}
