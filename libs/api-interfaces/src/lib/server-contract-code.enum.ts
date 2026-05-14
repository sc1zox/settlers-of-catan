export enum AuthErrorCode {
  MissingBearerSessionToken = 'missing_bearer_session_token',
  InvalidAccessToken = 'invalid_access_token',
  InvalidRefreshToken = 'invalid_refresh_token',
}

export enum InternalApiErrorCode {
  RequestIdMissing = 'request_id_missing',
}

export enum DescribeErrorMessage {
  UnknownError = 'unknown_error',
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
