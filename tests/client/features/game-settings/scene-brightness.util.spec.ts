import { SCENE_DISPLAY_SCOPE, SceneDisplayScopeKey } from '@catan/api-interfaces';
import { parseSceneBrightness } from '@catan/client/app/features/game-settings/scene-brightness.util';

describe('parseSceneBrightness', () => {
  const min = SCENE_DISPLAY_SCOPE[SceneDisplayScopeKey.BrightnessMin];
  const max = SCENE_DISPLAY_SCOPE[SceneDisplayScopeKey.BrightnessMax];
  const fallback = SCENE_DISPLAY_SCOPE[SceneDisplayScopeKey.BrightnessDefault];

  it('returns default for null or empty input', () => {
    expect(parseSceneBrightness(null)).toBe(fallback);
    expect(parseSceneBrightness('')).toBe(fallback);
  });

  it('clamps to configured bounds', () => {
    expect(parseSceneBrightness(String(min - 10))).toBe(min);
    expect(parseSceneBrightness(String(max + 10))).toBe(max);
  });

  it('parses valid numbers inside range', () => {
    const mid = Math.floor((min + max) / 2);
    expect(parseSceneBrightness(String(mid))).toBe(mid);
  });

  it('returns default for non-numeric input', () => {
    expect(parseSceneBrightness('bright')).toBe(fallback);
  });
});
