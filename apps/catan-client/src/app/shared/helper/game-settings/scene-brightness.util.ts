import { SCENE_DISPLAY_SCOPE, SceneDisplayScopeKey } from '@catan/api-interfaces';

export function parseSceneBrightness(stored: string | null): number {
  const min = SCENE_DISPLAY_SCOPE[SceneDisplayScopeKey.BrightnessMin];
  const max = SCENE_DISPLAY_SCOPE[SceneDisplayScopeKey.BrightnessMax];
  const fallback = SCENE_DISPLAY_SCOPE[SceneDisplayScopeKey.BrightnessDefault];
  if (stored === null || stored.length === 0) {
    return fallback;
  }
  const parsed = Number(stored);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  if (parsed < min) {
    return min;
  }
  if (parsed > max) {
    return max;
  }
  return parsed;
}
