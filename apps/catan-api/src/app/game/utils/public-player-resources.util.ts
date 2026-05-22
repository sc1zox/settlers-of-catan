import { ResourceType } from '@catan/api-interfaces';
import type { LobbyPlayerSlot } from '../lobby/lobby-runtime';

export function countResourceCards(player: LobbyPlayerSlot): number {
  let total = 0;
  const keys = Object.values(ResourceType);
  for (let i = 0; i < keys.length; i += 1) {
    total += player.resources[keys[i]] ?? 0;
  }
  return total;
}

export function emptyMutableResourceRecord(): Record<ResourceType, number> {
  const out: Partial<Record<ResourceType, number>> = {};
  const keys = Object.values(ResourceType);
  for (let i = 0; i < keys.length; i += 1) {
    out[keys[i]] = 0;
  }
  return out as Record<ResourceType, number>;
}

export function emptyPublicResourceRecord(): Readonly<Record<ResourceType, number>> {
  return emptyMutableResourceRecord();
}
