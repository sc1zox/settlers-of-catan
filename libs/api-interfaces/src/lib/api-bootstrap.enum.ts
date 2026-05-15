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
  LobbyCreate = 'lobby/create',
}

export enum ProcessEnvKey {
  Port = 'PORT',
  NodeEnv = 'NODE_ENV',
  CorsOrigins = 'CORS_ORIGINS',
  PlayerSessionJwtSecret = 'PLAYER_SESSION_JWT_SECRET',
  PlayerSessionAccessTtl = 'PLAYER_SESSION_ACCESS_TTL',
  PlayerSessionRefreshTtl = 'PLAYER_SESSION_REFRESH_TTL',
  RedisUrl = 'REDIS_URL',
  LiveKitApiKey = 'LIVEKIT_API_KEY',
  LiveKitApiSecret = 'LIVEKIT_API_SECRET',
  LiveKitPublicUrl = 'LIVEKIT_PUBLIC_URL',
  LiveKitHttpUrl = 'LIVEKIT_HTTP_URL',
}
