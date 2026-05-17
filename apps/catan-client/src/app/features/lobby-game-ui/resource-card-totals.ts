import { ResourceType } from '@catan/api-interfaces';

export function totalResourceCards(resources: Readonly<Record<ResourceType, number>>): number {
  let total = 0;
  const keys = Object.values(ResourceType);
  for (let i = 0; i < keys.length; i += 1) {
    total += resources[keys[i]] ?? 0;
  }
  return total;
}
