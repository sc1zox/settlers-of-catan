import { ActionRejectCode } from './action-reject-code.enum';
import { ResourceType } from './resource-type.enum';

const RESOURCE_TYPE_VALUES: readonly string[] = Object.values(ResourceType);

export function isResourceType(value: string): value is ResourceType {
  for (let i = 0; i < RESOURCE_TYPE_VALUES.length; i += 1) {
    if (RESOURCE_TYPE_VALUES[i] === value) {
      return true;
    }
  }
  return false;
}

export function assertResourceType(value: unknown): ResourceType {
  if (typeof value !== 'string' || !isResourceType(value)) {
    throw new Error(ActionRejectCode.InvalidPayload);
  }
  return value;
}

/**
 * Per-side validation: each entry must be a positive integer keyed by a
 * known resource. The map MAY be empty — a one-sided trade is legal (e.g.
 * "I want 1 wood, you tell me what you'd take" sends `offer: {}`).
 * Pair-level emptiness is checked separately via
 * {@link assertResourceTradePairHasContent}.
 */
export function assertValidResourceTradeMap(
  map: Readonly<Partial<Record<ResourceType, number>>> | undefined,
): void {
  if (map === undefined || typeof map !== 'object') {
    throw new Error(ActionRejectCode.InvalidPayload);
  }
  const keys = Object.keys(map);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (!isResourceType(key)) {
      throw new Error(ActionRejectCode.InvalidPayload);
    }
    const amount = map[key];
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
      throw new Error(ActionRejectCode.InvalidPayload);
    }
  }
}

/**
 * A trade with nothing on either side is a no-op — reject it at the action
 * layer. One side may be empty (beg or gift); both empty cannot be.
 */
export function assertResourceTradePairHasContent(
  offer: Readonly<Partial<Record<ResourceType, number>>>,
  request: Readonly<Partial<Record<ResourceType, number>>>,
): void {
  if (Object.keys(offer).length === 0 && Object.keys(request).length === 0) {
    throw new Error(ActionRejectCode.InvalidPayload);
  }
}

export function assertValidResourceDiscardMap(
  map: Readonly<Partial<Record<ResourceType, number>>> | undefined,
): void {
  if (map === undefined || typeof map !== 'object') {
    throw new Error(ActionRejectCode.InvalidPayload);
  }
  const keys = Object.keys(map);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (!isResourceType(key)) {
      throw new Error(ActionRejectCode.InvalidPayload);
    }
    const amount = map[key];
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0) {
      throw new Error(ActionRejectCode.InvalidPayload);
    }
  }
}
