export function tryParseBearerFromHeader(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  if (!value.startsWith('Bearer ')) {
    return undefined;
  }
  const token = value.slice(7).trim();
  return token.length > 0 ? token : undefined;
}
