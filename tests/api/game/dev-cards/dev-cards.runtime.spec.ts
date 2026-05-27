import { ActionRejectCode, DevCardType } from '@catan/api-interfaces';
import { consumeRipenedDevCard } from '@catan/api-app/app/game/dev-cards/dev-cards.runtime';
import { makeLobbyPlayerSlot } from '@catan/tests/fixtures/api/lobby-player-slot.fixture';

describe('consumeRipenedDevCard', () => {
  it('removes the oldest ripe card when a same-type card was bought this turn at the tail', () => {
    const player = makeLobbyPlayerSlot({});
    player.devCards = [DevCardType.Monopoly, DevCardType.Monopoly];
    player.devCardsBoughtThisTurn = [DevCardType.Monopoly];
    consumeRipenedDevCard(player, DevCardType.Monopoly);
    expect(player.devCards).toEqual([DevCardType.Monopoly]);
    expect(player.devCardsBoughtThisTurn).toEqual([DevCardType.Monopoly]);
  });

  it('throws DevCardBoughtThisTurn when only unripe copies exist', () => {
    const player = makeLobbyPlayerSlot({});
    player.devCards = [DevCardType.Monopoly];
    player.devCardsBoughtThisTurn = [DevCardType.Monopoly];
    expect(() => consumeRipenedDevCard(player, DevCardType.Monopoly)).toThrow(
      ActionRejectCode.DevCardBoughtThisTurn,
    );
  });

  it('throws DevCardNotOwned when the type is absent', () => {
    const player = makeLobbyPlayerSlot({});
    player.devCards = [DevCardType.Knight];
    player.devCardsBoughtThisTurn = [];
    expect(() => consumeRipenedDevCard(player, DevCardType.Monopoly)).toThrow(
      ActionRejectCode.DevCardNotOwned,
    );
  });
});
