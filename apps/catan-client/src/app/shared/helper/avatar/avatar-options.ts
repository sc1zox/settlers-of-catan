import { AvatarKind } from '@catan/api-interfaces';

export const SELECTABLE_AVATARS: readonly AvatarKind[] = [
  AvatarKind.Scout,
  AvatarKind.Sailor,
  AvatarKind.Builder,
];

export const DEFAULT_AVATAR_KIND = AvatarKind.Scout;

export function normalizeSelectableAvatarKind(value: string | null): AvatarKind {
  if (value === null) {
    return DEFAULT_AVATAR_KIND;
  }
  for (let i = 0; i < SELECTABLE_AVATARS.length; i += 1) {
    if (SELECTABLE_AVATARS[i] === value) {
      return SELECTABLE_AVATARS[i];
    }
  }
  return DEFAULT_AVATAR_KIND;
}
