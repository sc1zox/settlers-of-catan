import { LobbyFullStatePayload, PlayerSeat } from '@catan/api-interfaces';
import { collectRobberVictimSeats } from '@catan/shared-game-field';
import { RobberTilePick } from '../../../game-canvas/game-canvas';
import { RobberVictimCandidate } from '../../../game-canvas/robber-victim-popover';
import { totalResourceCards } from '../lobby-game-ui/resource-card-totals';

export function buildRobberVictimCandidates(
  payload: LobbyFullStatePayload,
  selfSeat: PlayerSeat,
  pick: RobberTilePick,
): RobberVictimCandidate[] {
  const victimSeats = collectRobberVictimSeats(
    payload.tiles,
    payload.settlements.map((s) => ({ seat: s.seat, vertexId: s.vertexId })),
    payload.players.map((p) => ({
      seat: p.seat,
      totalResourceCards: totalResourceCards(p.resources),
    })),
    selfSeat,
    pick.q,
    pick.r,
  );
  const allowed = new Set(victimSeats);
  return payload.players
    .filter((p) => allowed.has(p.seat))
    .map((p) => ({ seat: p.seat, name: p.displayName }));
}
