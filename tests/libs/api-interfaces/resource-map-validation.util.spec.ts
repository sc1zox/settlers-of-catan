import {
  ActionRejectCode,
  assertResourceTradePairHasContent,
  assertValidResourceDiscardMap,
  assertValidResourceTradeMap,
  isResourceType,
  ResourceType,
} from '@catan/api-interfaces';

describe('isResourceType', () => {
  it('recognizes wire enum values', () => {
    expect(isResourceType(ResourceType.Wood)).toBe(true);
  });

  it('rejects unknown strings', () => {
    expect(isResourceType('gold')).toBe(false);
  });
});

describe('assertValidResourceTradeMap', () => {
  it('allows empty map', () => {
    expect(() => assertValidResourceTradeMap({})).not.toThrow();
  });

  it('allows positive integer amounts', () => {
    expect(() => assertValidResourceTradeMap({ [ResourceType.Wood]: 2 })).not.toThrow();
  });

  it('rejects invalid keys and amounts', () => {
    expect(() => assertValidResourceTradeMap({ invalid: 1 } as never)).toThrow(
      ActionRejectCode.InvalidPayload,
    );
    expect(() => assertValidResourceTradeMap({ [ResourceType.Ore]: 0 })).toThrow(
      ActionRejectCode.InvalidPayload,
    );
    expect(() => assertValidResourceTradeMap({ [ResourceType.Ore]: 1.5 })).toThrow(
      ActionRejectCode.InvalidPayload,
    );
  });
});

describe('assertResourceTradePairHasContent', () => {
  it('allows one-sided trades', () => {
    expect(() => assertResourceTradePairHasContent({}, { [ResourceType.Wheat]: 1 })).not.toThrow();
    expect(() => assertResourceTradePairHasContent({ [ResourceType.Wood]: 1 }, {})).not.toThrow();
  });

  it('rejects completely empty pair', () => {
    expect(() => assertResourceTradePairHasContent({}, {})).toThrow(
      ActionRejectCode.InvalidPayload,
    );
  });
});

describe('assertValidResourceDiscardMap', () => {
  it('allows zero amounts', () => {
    expect(() => assertValidResourceDiscardMap({ [ResourceType.Brick]: 0 })).not.toThrow();
  });

  it('rejects negative amounts', () => {
    expect(() => assertValidResourceDiscardMap({ [ResourceType.Wool]: -1 })).toThrow(
      ActionRejectCode.InvalidPayload,
    );
  });
});
