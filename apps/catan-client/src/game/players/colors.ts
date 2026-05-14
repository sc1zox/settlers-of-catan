import { EnumTranslate } from '../i18n/enum-translate.helper';
import { gt } from '../i18n-bridge';
import { PlayerColor } from './player-color.enum';

export { PlayerColor } from './player-color.enum';

export function playerColorLabel(color: PlayerColor): string {
  return EnumTranslate.translatePlayerColor(gt, color);
}

export const PLAYER_SEAT_ORDER: readonly PlayerColor[] = Object.freeze([
  PlayerColor.Red,
  PlayerColor.Blue,
  PlayerColor.White,
  PlayerColor.Orange,
]);
