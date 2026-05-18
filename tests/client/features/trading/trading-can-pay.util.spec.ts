import { ResourceType } from '@catan/api-interfaces';
import { canPayResourceMap } from '@catan/client/app/features/trading/trading-can-pay.util';

describe('canPayResourceMap', () => {
  it('returns true when owned meets every cost entry', () => {
    const owned = {
      [ResourceType.Wood]: 2,
      [ResourceType.Brick]: 1,
    };
    const cost = {
      [ResourceType.Wood]: 1,
      [ResourceType.Brick]: 1,
    };
    expect(canPayResourceMap(owned, cost)).toBe(true);
  });

  it('returns true for empty cost', () => {
    expect(canPayResourceMap({ [ResourceType.Ore]: 0 }, {})).toBe(true);
  });

  it('returns false when any resource is short', () => {
    const owned = { [ResourceType.Wheat]: 1 };
    const cost = { [ResourceType.Wheat]: 2 };
    expect(canPayResourceMap(owned, cost)).toBe(false);
  });

  it('treats missing owned keys as zero', () => {
    const cost = { [ResourceType.Wool]: 1 };
    expect(canPayResourceMap({}, cost)).toBe(false);
  });

  it('treats missing cost keys as zero need', () => {
    const owned = { [ResourceType.Ore]: 3 };
    const cost = { [ResourceType.Ore]: 0 };
    expect(canPayResourceMap(owned, cost)).toBe(true);
  });
});
