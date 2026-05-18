import {
  isCanonicalLobbyId,
  isLobbyCodeValid,
  LOBBY_CODE_MAX_LENGTH,
  LOBBY_CODE_MIN_LENGTH,
  normalizeLobbyCode,
} from '@catan/api-interfaces';

describe('normalizeLobbyCode', () => {
  it('trims and lowercases', () => {
    expect(normalizeLobbyCode('  AbC-12  ')).toBe('abc-12');
  });
});

describe('isLobbyCodeValid', () => {
  it('accepts alphanumeric codes within length bounds', () => {
    expect(isLobbyCodeValid('ab')).toBe(true);
    expect(isLobbyCodeValid('my-lobby_1')).toBe(true);
  });

  it('rejects too short or too long codes', () => {
    expect(isLobbyCodeValid('a')).toBe(false);
    expect(isLobbyCodeValid('x'.repeat(LOBBY_CODE_MAX_LENGTH + 1))).toBe(false);
  });

  it('rejects leading punctuation', () => {
    expect(isLobbyCodeValid('-abc')).toBe(false);
  });

  it('respects documented min length', () => {
    expect(LOBBY_CODE_MIN_LENGTH).toBe(2);
  });
});

describe('isCanonicalLobbyId', () => {
  it('accepts lowercase uuid v4', () => {
    expect(isCanonicalLobbyId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('rejects non-uuid strings', () => {
    expect(isCanonicalLobbyId('lobby-canonical')).toBe(false);
    expect(isCanonicalLobbyId('')).toBe(false);
  });
});
