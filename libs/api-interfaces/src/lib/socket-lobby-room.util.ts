import { SocketIoLobbyRoomPrefix } from './socket-wire.enum';

export function formatSocketIoLobbyRoomId(lobbyId: string): string {
  return `${SocketIoLobbyRoomPrefix.Lobby}${lobbyId}`;
}
