import { Observable } from 'rxjs';

export function observeAbort(signal: AbortSignal): Observable<void> {
  return new Observable<void>((subscriber) => {
    const onAbort = (): void => {
      subscriber.next();
      subscriber.complete();
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });
    return () => signal.removeEventListener('abort', onAbort);
  });
}
