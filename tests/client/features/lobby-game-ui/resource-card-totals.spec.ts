import { ResourceType } from '@catan/api-interfaces';
import { totalResourceCards } from '@catan/client/app/features/lobby-game-ui/resource-card-totals';

describe('totalResourceCards', () => {
  it('sums all resource buckets', () => {
    const total = totalResourceCards({
      [ResourceType.Wood]: 2,
      [ResourceType.Brick]: 1,
      [ResourceType.Wheat]: 0,
      [ResourceType.Wool]: 3,
      [ResourceType.Ore]: 1,
    });
    expect(total).toBe(7);
  });

  it('returns zero for an empty hand', () => {
    expect(totalResourceCards({} as Record<ResourceType, number>)).toBe(0);
  });
});
