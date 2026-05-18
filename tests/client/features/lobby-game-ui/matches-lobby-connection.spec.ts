import { normalizeLobbyCode } from '@catan/api-interfaces';
import { matchesLobbyConnection } from '@catan/client/app/features/lobby-game-ui/matches-lobby-connection';

describe('matchesLobbyConnection', () => {
  it('matches canonical lobby id when params carry it', () => {
    expect(
      matchesLobbyConnection('uuid-lobby', 'CODE', {
        lobbyId: 'uuid-lobby',
        lobbyCode: 'ignored',
        displayName: 'Alice',
      }),
    ).toBe(true);
  });

  it('falls back to normalized lobby code when params have no id yet', () => {
    const code = normalizeLobbyCode('MyLobby');
    expect(
      matchesLobbyConnection('', 'mylobby', {
        lobbyId: '',
        lobbyCode: code,
        displayName: 'Alice',
      }),
    ).toBe(true);
  });

  it('returns false when neither id nor code match', () => {
    expect(
      matchesLobbyConnection('uuid-a', 'lobby-b', {
        lobbyId: 'uuid-c',
        lobbyCode: 'lobby-d',
        displayName: 'Alice',
      }),
    ).toBe(false);
  });
});
