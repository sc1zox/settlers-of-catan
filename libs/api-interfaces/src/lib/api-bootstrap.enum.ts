export enum ApiGlobalPathPrefix {
  Rest = 'api',
}

export enum SwaggerUiPath {
  Docs = 'docs',
}

export enum HttpApiRelativePath {
  SessionPing = 'session/ping',
  SessionBootstrap = 'session/bootstrap',
  SessionRefresh = 'session/refresh',
}

export enum ProcessEnvKey {
  Port = 'PORT',
  NodeEnv = 'NODE_ENV',
  CorsOrigins = 'CORS_ORIGINS',
  PlayerSessionJwtSecret = 'PLAYER_SESSION_JWT_SECRET',
  PlayerSessionAccessTtl = 'PLAYER_SESSION_ACCESS_TTL',
  PlayerSessionRefreshTtl = 'PLAYER_SESSION_REFRESH_TTL',
}
