export enum ClientStorageKey {
  SessionToken = 'catan.sessionToken',
  PlayerSessionId = 'catan.playerSessionId',
  AccessToken = 'catan.accessToken',
  RefreshToken = 'catan.refreshToken',
  UiLocale = 'catan.uiLocale',
  AvatarKind = 'catan.avatarKind',
}

export enum UiLocale {
  De = 'de',
  En = 'en',
}

export enum KnownLobbyId {
  DemoClient = 'demo',
  ServerDefault = 'default',
}

export enum DefaultDisplayName {
  PlayerEn = 'Player',
  PlayerDe = 'Spieler',
}

export enum DevelopmentApiOrigin {
  LocalHttp = 'http://localhost:3000',
}

export enum SessionHttpAction {
  Bootstrap = 'bootstrap',
  Refresh = 'refresh',
}

export enum SessionRestPath {
  Prefix = 'session',
}
