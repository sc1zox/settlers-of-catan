import { DevCardType, ResourceType } from '@catan/api-interfaces';
import {
  computeHandSignature,
  computeOpponentHandSignature,
} from '@catan/client/game/engine-runtime/resource-hand';

const emptyResources = (): Record<ResourceType, number> => ({
  [ResourceType.Wood]: 0,
  [ResourceType.Brick]: 0,
  [ResourceType.Wheat]: 0,
  [ResourceType.Wool]: 0,
  [ResourceType.Ore]: 0,
});

describe('computeOpponentHandSignature', () => {
  it('encodes totalResourceCards and devCardsInHand', () => {
    expect(computeOpponentHandSignature(7, 2)).toBe('opp|7|2');
  });

  it('produces different signatures for different totalResourceCards', () => {
    expect(computeOpponentHandSignature(3, 1)).not.toBe(computeOpponentHandSignature(4, 1));
  });

  it('produces different signatures for different devCardsInHand', () => {
    expect(computeOpponentHandSignature(3, 1)).not.toBe(computeOpponentHandSignature(3, 2));
  });

  it('returns stable output for the same inputs', () => {
    const a = computeOpponentHandSignature(5, 0);
    const b = computeOpponentHandSignature(5, 0);
    expect(a).toBe(b);
  });
});

describe('computeHandSignature', () => {
  it('encodes devCardsInHand at the start', () => {
    const sig0 = computeHandSignature(emptyResources(), 0, null);
    const sig2 = computeHandSignature(emptyResources(), 2, null);
    expect(sig0).not.toBe(sig2);
    expect(sig0.startsWith('0|')).toBe(true);
    expect(sig2.startsWith('2|')).toBe(true);
  });

  it('encodes individual resource counts', () => {
    const resources = { ...emptyResources(), [ResourceType.Wood]: 3, [ResourceType.Ore]: 1 };
    const sigWith = computeHandSignature(resources, 0, null);
    const sigEmpty = computeHandSignature(emptyResources(), 0, null);
    expect(sigWith).not.toBe(sigEmpty);
  });

  it('treats missing resource keys as zero', () => {
    const partial = { [ResourceType.Wood]: 0 } as Record<ResourceType, number>;
    const full = emptyResources();
    expect(computeHandSignature(partial, 0, null)).toBe(computeHandSignature(full, 0, null));
  });

  it('returns same signature for identical inputs', () => {
    const resources = { ...emptyResources(), [ResourceType.Wheat]: 2 };
    expect(computeHandSignature(resources, 1, null)).toBe(
      computeHandSignature({ ...emptyResources(), [ResourceType.Wheat]: 2 }, 1, null),
    );
  });

  it('null devCardTypes omits the d: suffix', () => {
    const sig = computeHandSignature(emptyResources(), 0, null);
    expect(sig.includes('|d:')).toBe(false);
  });

  it('empty devCardTypes array includes the d: suffix with empty content', () => {
    const sig = computeHandSignature(emptyResources(), 0, []);
    expect(sig.includes('|d:')).toBe(true);
  });

  it('null and empty-array devCardTypes produce different signatures', () => {
    const withNull = computeHandSignature(emptyResources(), 0, null);
    const withEmpty = computeHandSignature(emptyResources(), 0, []);
    expect(withNull).not.toBe(withEmpty);
  });

  it('same-length devCardTypes arrays with different content produce different signatures', () => {
    const withKnight = computeHandSignature(emptyResources(), 1, [DevCardType.Knight]);
    const withMonopoly = computeHandSignature(emptyResources(), 1, [DevCardType.Monopoly]);
    expect(withKnight).not.toBe(withMonopoly);
  });

  it('different devCardTypes orderings produce different signatures', () => {
    const ab = computeHandSignature(emptyResources(), 2, [DevCardType.Knight, DevCardType.Monopoly]);
    const ba = computeHandSignature(emptyResources(), 2, [DevCardType.Monopoly, DevCardType.Knight]);
    expect(ab).not.toBe(ba);
  });

  it('multiple dev cards of the same type produce different signatures from one', () => {
    const one = computeHandSignature(emptyResources(), 1, [DevCardType.Knight]);
    const two = computeHandSignature(emptyResources(), 2, [DevCardType.Knight, DevCardType.Knight]);
    expect(one).not.toBe(two);
  });
});
