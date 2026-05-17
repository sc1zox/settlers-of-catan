export enum ClientStorageKey {
  SessionToken = 'catan.sessionToken',
  PlayerSessionId = 'catan.playerSessionId',
  AccessToken = 'catan.accessToken',
  RefreshToken = 'catan.refreshToken',
  UiLocale = 'catan.uiLocale',
  AvatarKind = 'catan.avatarKind',
  ShadowQuality = 'catan.shadowQuality',
  PerformanceOverlay = 'catan.performanceOverlay',
  WebcamEnabled = 'catan.webcamEnabled',
  WebcamQuality = 'catan.webcamQuality',
  SceneBrightness = 'catan.sceneBrightness',
}

export enum UiLocale {
  De = 'de',
  En = 'en',
}

export enum KnownLobbyId {
  ServerDefault = 'default',
}

export enum DefaultDisplayName {
  PlayerEn = 'Player',
  PlayerDe = 'Spieler',
}

export enum DevelopmentApiOrigin {
  LocalHttp = 'http://localhost:3000',
}

export enum ProductionClientApiOrigin {
  SameHostRelative = '',
}

export enum SessionHttpAction {
  Bootstrap = 'bootstrap',
  Refresh = 'refresh',
  Logout = 'logout',
}

export enum SessionRestPath {
  Prefix = 'session',
}
