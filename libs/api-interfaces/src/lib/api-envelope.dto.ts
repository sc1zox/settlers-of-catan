export interface ApiEnvelope<T> {
  readonly data: T;
  readonly requestId: string;
}
