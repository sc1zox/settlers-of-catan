const UUID_RE = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
