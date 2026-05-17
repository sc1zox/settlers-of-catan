import { Observable } from 'rxjs';
import { defaultIfEmpty, takeUntil } from 'rxjs/operators';
import { observeAbort } from './observe-abort';

export function rxResourceStream<T>(
  source: Observable<T>,
  abortSignal: AbortSignal,
  seed: T,
): Observable<T> {
  return source.pipe(takeUntil(observeAbort(abortSignal)), defaultIfEmpty(seed));
}
