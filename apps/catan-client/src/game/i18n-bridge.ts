export type GameTranslateFn = (key: string, params?: Record<string, string | number>) => string;

let translateImpl: GameTranslateFn | null = null;

export function setGameTranslateFn(fn: GameTranslateFn | null): void {
  translateImpl = fn;
}

export function gt(key: string, params?: Record<string, string | number>): string {
  if (translateImpl === null) {
    return key;
  }
  return translateImpl(key, params);
}
