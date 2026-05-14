/**
 * Classifies a raycast target in the Three.js scene. Stored on an
 * `Object3D.userData` under {@link SceneUserDataKey.Kind} and read back by the
 * hover system to decide how an object reacts to hover / click.
 */
export enum SceneObjectKind {
  Harbor = 'harbor',
  Chip = 'chip',
  Card = 'card',
  Die = 'die',
  /** A translucent ghost figure marking a legal build location. */
  BuildSpot = 'build-spot',
  /** A figure in the local player's stash that opens build mode when clicked. */
  Arsenal = 'arsenal',
}

/** Keys used on Three.js `Object3D.userData` to carry interaction metadata. */
export enum SceneUserDataKey {
  Kind = 'kind',
  Harbor = 'harbor',
  Tile = 'tile',
  Card = 'card',
  Die = 'die',
  /** {@link BuildKind} the object represents (build-spot / arsenal figures). */
  BuildKind = 'buildKind',
  /** Server vertex- or edge-id a build-spot ghost stands on. */
  BuildId = 'buildId',
}
