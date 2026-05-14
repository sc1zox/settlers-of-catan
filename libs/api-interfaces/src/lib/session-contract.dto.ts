export interface PlayerSessionBundleResponse {
  readonly sessionId: string;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessExpiresInSec: number;
}
