import { ResourceType } from '@catan/api-interfaces';
import { GameActionValidationService } from '@catan/api-app/app/game/validation/game-action-validation.service';
import { makeLobbyPlayerSlot } from '@catan/tests/fixtures/api/lobby-player-slot.fixture';

describe('GameActionValidationService.canAffordDevCardCost', () => {
  const validation = new GameActionValidationService();

  it('returns true when player has wheat, wool, and ore', () => {
    const player = makeLobbyPlayerSlot({
      [ResourceType.Wheat]: 1,
      [ResourceType.Wool]: 1,
      [ResourceType.Ore]: 1,
    });
    expect(validation.canAffordDevCardCost(player)).toBe(true);
  });

  it('returns false when any dev-card cost resource is missing', () => {
    const player = makeLobbyPlayerSlot({
      [ResourceType.Wheat]: 1,
      [ResourceType.Wool]: 1,
      [ResourceType.Ore]: 0,
    });
    expect(validation.canAffordDevCardCost(player)).toBe(false);
  });

  it('assertDevCardCost throws when unaffordable', () => {
    const player = makeLobbyPlayerSlot({ [ResourceType.Ore]: 0 });
    expect(() => validation.assertDevCardCost(player)).toThrow();
  });
});
