import { ResourceType } from '@catan/api-interfaces';
import { ResourceKind } from '../cards/textures';
import { RESOURCE_TYPE_TO_KIND } from './constants';

export function expandResourceHand(resources: Readonly<Record<ResourceType, number>>): ResourceKind[] {
  const hand: ResourceKind[] = [];
  const types = Object.keys(RESOURCE_TYPE_TO_KIND) as ResourceType[];
  for (let i = 0; i < types.length; i += 1) {
    const type = types[i];
    const count = resources[type] ?? 0;
    for (let n = 0; n < count; n += 1) {
      hand.push(RESOURCE_TYPE_TO_KIND[type]);
    }
  }
  return hand;
}

export function computeHandSignature(
  resources: Readonly<Record<ResourceType, number>>,
  devCardsInHand: number,
): string {
  const keys = Object.keys(RESOURCE_TYPE_TO_KIND) as ResourceType[];
  let signature = `${devCardsInHand}`;
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    signature += `|${resources[key] ?? 0}`;
  }
  return signature;
}
