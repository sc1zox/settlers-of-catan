import { ResourceType } from '@catan/api-interfaces';

export function canPayResourceMap(
  owned: Readonly<Partial<Record<ResourceType, number>>>,
  cost: Readonly<Partial<Record<ResourceType, number>>>,
): boolean {
  const keys = Object.keys(cost) as ResourceType[];
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const need = cost[key] ?? 0;
    if ((owned[key] ?? 0) < need) {
      return false;
    }
  }
  return true;
}
