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

export function assertValidResourceTradeMap(
  map: Readonly<Partial<Record<ResourceType, number>>> | undefined,
): void {
  if (map === undefined || typeof map !== 'object') {
    throw new Error(ActionRejectCode.InvalidPayload);
  }
  const keys = Object.keys(map);
  if (keys.length === 0) {
    throw new Error(ActionRejectCode.InvalidPayload);
  }
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
