import type { LobbyFullStatePayload } from '@catan/api-interfaces';
import type { LobbyScenePlayerState, LobbySceneState } from './lobby-scene-state';

export function mapLobbyFullStateToSceneState(payload: LobbyFullStatePayload): LobbySceneState {
  const players: LobbyScenePlayerState[] = [];
  for (let i = 0; i < payload.players.length; i += 1) {
    const p = payload.players[i];
    players.push({
      seat: p.seat,
      displayName: p.displayName,
      isSelf: p.isSelf,
      isBot: p.isBot,
      resources: p.resources,
      devCardsInHand: p.devCardsInHand,
    });
  }
  return {
    phase: payload.phase,
    seed: payload.seed,
    players,
    settlements: payload.settlements,
    roads: payload.roads,
    robberCoord: payload.robberCoord,
    legalSettlementVertexIds: payload.legalSettlementVertexIds,
    legalRoadEdgeIds: payload.legalRoadEdgeIds,
    legalCityVertexIds: payload.legalCityVertexIds,
    legalRoadBuildingEdgeIds: payload.legalRoadBuildingEdgeIds,
    longestRoadSeat: payload.longestRoadSeat,
    largestArmySeat: payload.largestArmySeat,
  };
}
