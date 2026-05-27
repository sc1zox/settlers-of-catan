/**
 * Global render-time flags read by Tile subclasses, decorations, and any other
 * subsystem that runs ambient (decorative) animation. Tightening this here lets
 * the Angular settings layer flip a single switch and have every per-frame
 * decorative wiggle skip its work — without threading a new arg through every
 * `update(dt, t)` signature on every subclass.
 *
 * Only ambient/decorative motion belongs here. Gameplay-driving animation
 * (build pop-ins, card flights, dice physics, robber moves) stays on.
 */
export const runtimeFlags = {
  ambientAnimationsEnabled: true,
};

export function setAmbientAnimationsEnabled(enabled: boolean): void {
  runtimeFlags.ambientAnimationsEnabled = enabled;
}
