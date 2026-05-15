export enum SceneDisplayScopeKey {
  BrightnessMin = 'brightnessMin',
  BrightnessMax = 'brightnessMax',
  BrightnessDefault = 'brightnessDefault',
}

export const SCENE_DISPLAY_SCOPE: Readonly<Record<SceneDisplayScopeKey, number>> = {
  [SceneDisplayScopeKey.BrightnessMin]: 0.55,
  [SceneDisplayScopeKey.BrightnessMax]: 1.45,
  [SceneDisplayScopeKey.BrightnessDefault]: 1.0,
};
