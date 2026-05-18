import { PlayerSeat, ResourceType } from '@catan/api-interfaces';
import type { LobbyPlayerSlot } from '@catan/api-app/app/game/lobby/lobby-runtime';

export function makeLobbyPlayerSlot(
  resources: Readonly<Partial<Record<ResourceType, number>>>,
): LobbyPlayerSlot {
  const fullResources: Record<ResourceType, number> = {
    [ResourceType.Wood]: 0,
    [ResourceType.Brick]: 0,
    [ResourceType.Wheat]: 0,
    [ResourceType.Wool]: 0,
    [ResourceType.Ore]: 0,
  };
  const keys = Object.keys(resources) as ResourceType[];
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    fullResources[key] = resources[key] ?? 0;
  }
  return {
    sessionToken: 'test-session',
    displayName: 'Tester',
    isBot: false,
    seat: PlayerSeat.North,
    socketId: null,
    resources: fullResources,
    devCards: [],
    devCardsBoughtThisTurn: [],
    hasPlayedDevCardThisTurn: false,
    playedKnights: 0,
    visibleVictoryPoints: 0,
    longestRoadLength: 0,
    hasLongestRoad: false,
    hasLargestArmy: false,
    disconnectTimer: null,
    disconnectGraceExpiresAt: null,
    awaitingAdminDecision: false,
  };
}
