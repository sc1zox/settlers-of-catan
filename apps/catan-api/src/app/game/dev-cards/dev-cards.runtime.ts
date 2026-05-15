import { ActionRejectCode, DevCardType } from '@catan/api-interfaces';
import type { LobbyPlayerSlot, LobbyRuntime } from '../lobby/lobby-runtime';

/**
 * Consume a playable ("ripened") dev card of the given type — i.e. one that
 * was already in the player's hand at the start of the current turn. Throws
 * `DevCardBoughtThisTurn` when the player owns the card but only bought it
 * this turn (real-Catan rule: can't play the turn you draw), and
 * `DevCardNotOwned` when the player doesn't own it at all.
 */
export function consumeRipenedDevCard(player: LobbyPlayerSlot, card: DevCardType): void {
  const ownedCount = countOf(player.devCards, card);
  if (ownedCount === 0) {
    throw new Error(ActionRejectCode.DevCardNotOwned);
  }
  const freshCount = countOf(player.devCardsBoughtThisTurn, card);
  if (ownedCount - freshCount <= 0) {
    throw new Error(ActionRejectCode.DevCardBoughtThisTurn);
  }
  const idx = player.devCards.indexOf(card);
  player.devCards.splice(idx, 1);
}

/** Real-Catan rule: at most one non-VP dev card per turn. */
export function assertNoDevCardPlayedThisTurn(player: LobbyPlayerSlot): void {
  if (player.hasPlayedDevCardThisTurn) {
    throw new Error(ActionRejectCode.DevCardAlreadyPlayed);
  }
}

export function markDevCardPlayedThisTurn(player: LobbyPlayerSlot): void {
  player.hasPlayedDevCardThisTurn = true;
}

/** Called by MatchFlowService at end of turn. */
export function resetTurnDevCardState(lobby: LobbyRuntime): void {
  for (let i = 0; i < lobby.players.length; i += 1) {
    const player = lobby.players[i];
    player.hasPlayedDevCardThisTurn = false;
    player.devCardsBoughtThisTurn = [];
  }
}

function countOf(arr: readonly DevCardType[], card: DevCardType): number {
  let count = 0;
  for (let i = 0; i < arr.length; i += 1) {
    if (arr[i] === card) {
      count += 1;
    }
  }
  return count;
}
