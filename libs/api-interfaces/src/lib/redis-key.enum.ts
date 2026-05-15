export enum RedisKeyPrefix {
  LobbyMeta = 'catan:lobby',
  LobbyMembers = 'catan:lobby',
  LobbyAlias = 'catan:lobby:alias',
  SessionLobby = 'catan:session',
}

export enum RedisKeySegment {
  Meta = 'meta',
  Members = 'members',
  Lobby = 'lobby',
  LobbyCode = 'lobbyCode',
}
