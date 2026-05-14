import { marker } from '@colsen1991/ngx-translate-extract-marker';
import de from '../../assets/i18n/de.json';

function flattenTranslationKeys(node: unknown, prefix: string): string[] {
  const keys: string[] = [];
  if (node === null || node === undefined) {
    return keys;
  }
  if (typeof node !== 'object') {
    return keys;
  }
  if (Array.isArray(node)) {
    return keys;
  }
  const record = node as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const v = record[key];
    const path = prefix.length > 0 ? `${prefix}.${key}` : key;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      const nested = flattenTranslationKeys(v, path);
      for (let i = 0; i < nested.length; i++) {
        keys.push(nested[i]);
      }
    } else {
      keys.push(path);
    }
  }
  return keys;
}

export function registerTranslationMarkers(): void {
  const all = flattenTranslationKeys(de, '');
  for (let i = 0; i < all.length; i++) {
    marker(all[i]);
  }
}
