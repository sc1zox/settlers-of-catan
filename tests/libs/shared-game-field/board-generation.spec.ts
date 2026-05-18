import { makeStandardLandPlacements } from '@catan/shared-game-field';

describe('makeStandardLandPlacements', () => {
  it('is deterministic for the same seed', () => {
    const first = makeStandardLandPlacements(42);
    const second = makeStandardLandPlacements(42);
    expect(second).toEqual(first);
  });

  it('differs for different seeds', () => {
    const first = makeStandardLandPlacements(1);
    const second = makeStandardLandPlacements(2);
    expect(second).not.toEqual(first);
  });

  it('places desert at center with 18 resource tiles', () => {
    const placements = makeStandardLandPlacements(99);
    expect(placements.length).toBe(19);
    const center = placements.find((tile) => tile.coord.q === 0 && tile.coord.r === 0);
    expect(center?.number).toBeNull();
  });
});
