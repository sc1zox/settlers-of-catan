export interface PlayerSessionBundleResponse {
  readonly sessionId: string;
  readonly accessToken: string;
  readonly accessExpiresInSec: number;
}
