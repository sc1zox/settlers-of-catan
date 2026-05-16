import { randomInt } from 'node:crypto';
import { DevCardType } from '@catan/api-interfaces';

/**
 * Standard Catan development-card composition: 25 cards total.
 * 14 knights, 5 victory points, 2 each of monopoly / year of plenty / road building.
 */
export const DEV_CARD_DECK_COMPOSITION: readonly {
  readonly card: DevCardType;
  readonly count: number;
}[] = [
  { card: DevCardType.Knight, count: 14 },
  { card: DevCardType.VictoryPoint, count: 5 },
  { card: DevCardType.Monopoly, count: 2 },
  { card: DevCardType.YearOfPlenty, count: 2 },
  { card: DevCardType.RoadBuilding, count: 2 },
];

export function createShuffledDevDeck(): DevCardType[] {
  const cards: DevCardType[] = [];
  for (let i = 0; i < DEV_CARD_DECK_COMPOSITION.length; i += 1) {
    const entry = DEV_CARD_DECK_COMPOSITION[i];
    for (let n = 0; n < entry.count; n += 1) {
      cards.push(entry.card);
    }
  }
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    const swap = cards[i];
    cards[i] = cards[j];
    cards[j] = swap;
  }
  return cards;
}
