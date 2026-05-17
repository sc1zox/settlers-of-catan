export enum AuthErrorCode {
  MissingBearerSessionToken = 'missing_bearer_session_token',
  InvalidAccessToken = 'invalid_access_token',
  InvalidRefreshToken = 'invalid_refresh_token',
  InvalidRequest = 'invalid_request',
}

export enum HttpErrorCode {
  TooManyRequests = 'too_many_requests',
}

export enum InternalApiErrorCode {
  RequestIdMissing = 'request_id_missing',
  Unexpected = 'unexpected_error',
}

export enum RouteAccessMetadataKey {
  IsPublic = 'isPublic',
}

export enum ApiEnvelopeFieldKey {
  Data = 'data',
  RequestId = 'requestId',
}

export enum SwaggerApiTag {
  System = 'system',
  Session = 'session',
}
