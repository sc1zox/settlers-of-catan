import type { Object3D } from 'three';

/**
 * Callback signatures the Three.js hover system invokes for interaction
 * targets. Kept here (alongside the wire enums) so both the hover system and
 * the engine share one definition. The `import type` keeps this lib free of a
 * runtime dependency on `three`.
 */

/** Cursor moved onto / off a {@link SceneObjectKind.BuildSpot} ghost figure. */
export type BuildSpotHoverHandler = (figure: Object3D | null) => void;

/** A {@link SceneObjectKind.BuildSpot} ghost figure was clicked. */
export type BuildSpotClickHandler = (
  figure: Object3D,
  screenX: number,
  screenY: number,
) => void;

/** A {@link SceneObjectKind.Arsenal} figure in the local player's stash was clicked. */
export type ArsenalClickHandler = (figure: Object3D) => void;

/** A board tile's number chip was clicked (used during robber placement). */
export type TileClickHandler = (chip: Object3D, screenX: number, screenY: number) => void;
