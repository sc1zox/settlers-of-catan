import { formatSocketIoLobbyRoomId, SocketIoLobbyRoomPrefix } from '@catan/api-interfaces';

describe('formatSocketIoLobbyRoomId', () => {
  it('prefixes the canonical lobby id', () => {
    const lobbyId = '550e8400-e29b-41d4-a716-446655440000';
    expect(formatSocketIoLobbyRoomId(lobbyId)).toBe(`${SocketIoLobbyRoomPrefix.Lobby}${lobbyId}`);
  });
});
