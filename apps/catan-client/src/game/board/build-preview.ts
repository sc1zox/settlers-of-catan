import {
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three';
import { BuildKind, SceneObjectKind, SceneUserDataKey } from '@catan/api-interfaces';
import { makeCity, makeRoad, makeSettlement, PlayerFigureMaterials } from '../players/figures';
import { TILE_HEIGHT } from '../tiles/tile';
import { edgeIdToWorld, vertexIdToWorld } from './board-coords';

const SETTLEMENT_SCALE = 1.7;
const CITY_SCALE = 1.7;
const ROAD_WIDTH_SCALE = 1.7;
/** Local X length of the road bar from `makeRoad`. */
const ROAD_BAR_LENGTH = 0.55;
/** Fraction of the edge a ghost road bar spans. */
const ROAD_EDGE_FILL = 0.74;
/** Ghosts float a hair above the slab so they never z-fight with the tile top. */
const GHOST_LIFT = 0.02;
const GHOST_OPACITY = 0.42;
/** Extra size a hovered ghost grows to, so the targeted spot reads clearly. */
const GHOST_HOVER_GROW = 0.32;

interface BuildSpot {
  readonly figure: Group;
  readonly kind: BuildKind;
  readonly id: string;
  readonly baseScale: Vector3;
  hovered: boolean;
  hoverT: number;
}

/**
 * Translucent "ghost" figures rendered at every spot the local player may
 * legally build right now. Owned by `GameEngine`: shown via `show()` when the
 * player enters build mode, hover-highlighted by the `HoverSystem`, and the
 * figures themselves are the raycast targets for build-spot clicks
 * (`userData['kind'] = 'build-spot'`).
 */
export class BuildPreview {
  readonly group: Group = new Group();

  private spots: BuildSpot[] = [];
  private materials: PlayerFigureMaterials | null = null;
  private readonly trackedGeometries: BufferGeometry[] = [];
  private pulse = 0;

  /** Render ghosts for `ids` of the given build kind in the player's colour. */
  show(kind: BuildKind, ids: readonly string[], color: number): void {
    this.clear();
    this.materials = this.createGhostMaterials(color);
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i];
      const figure = this.makeFigure(kind);
      if (kind === BuildKind.Road) {
        const edge = edgeIdToWorld(id);
        figure.position.set(edge.position.x, TILE_HEIGHT + GHOST_LIFT, edge.position.z);
        figure.rotation.y = edge.angle;
        figure.scale.set(
          (edge.length * ROAD_EDGE_FILL) / ROAD_BAR_LENGTH,
          ROAD_WIDTH_SCALE,
          ROAD_WIDTH_SCALE,
        );
      } else {
        const world = vertexIdToWorld(id);
        figure.position.set(world.x, TILE_HEIGHT + GHOST_LIFT, world.z);
        figure.scale.setScalar(kind === BuildKind.City ? CITY_SCALE : SETTLEMENT_SCALE);
      }
      figure.userData[SceneUserDataKey.Kind] = SceneObjectKind.BuildSpot;
      figure.userData[SceneUserDataKey.BuildKind] = kind;
      figure.userData[SceneUserDataKey.BuildId] = id;
      this.trackGeometries(figure);
      this.group.add(figure);
      this.spots.push({
        figure,
        kind,
        id,
        baseScale: figure.scale.clone(),
        hovered: false,
        hoverT: 0,
      });
    }
  }

  /** Raycast targets the hover system should consider while build mode is on. */
  hoverables(): Object3D[] {
    const list: Object3D[] = [];
    for (let i = 0; i < this.spots.length; i += 1) {
      list.push(this.spots[i].figure);
    }
    return list;
  }

  /** Highlight the ghost the cursor is over (called by the engine each frame). */
  setHovered(figure: Object3D | null): void {
    for (let i = 0; i < this.spots.length; i += 1) {
      this.spots[i].hovered = this.spots[i].figure === figure;
    }
  }

  update(dt: number): void {
    if (this.spots.length === 0) return;
    this.pulse += dt;
    if (this.materials) {
      const glow = 0.34 + 0.16 * Math.sin(this.pulse * 3.2);
      this.materials.body.emissiveIntensity = glow;
      this.materials.accent.emissiveIntensity = glow;
      this.materials.dark.emissiveIntensity = glow * 0.7;
    }
    for (let i = 0; i < this.spots.length; i += 1) {
      const spot = this.spots[i];
      const target = spot.hovered ? 1 : 0;
      spot.hoverT += (target - spot.hoverT) * Math.min(1, dt * 12);
      const factor = 1 + spot.hoverT * GHOST_HOVER_GROW;
      spot.figure.scale.set(
        spot.baseScale.x * factor,
        spot.baseScale.y * factor,
        spot.baseScale.z * factor,
      );
    }
  }

  /** Remove all ghosts and free their GPU resources. */
  clear(): void {
    for (let i = 0; i < this.spots.length; i += 1) {
      this.group.remove(this.spots[i].figure);
    }
    this.spots = [];
    for (let i = 0; i < this.trackedGeometries.length; i += 1) {
      this.trackedGeometries[i].dispose();
    }
    this.trackedGeometries.length = 0;
    if (this.materials) {
      this.materials.body.dispose();
      this.materials.accent.dispose();
      this.materials.dark.dispose();
      this.materials = null;
    }
    this.pulse = 0;
  }

  dispose(): void {
    this.clear();
  }

  private makeFigure(kind: BuildKind): Group {
    const mats = this.materials;
    if (mats === null) {
      throw new Error('BuildPreview.makeFigure called before materials were created.');
    }
    if (kind === BuildKind.Road) return makeRoad(mats);
    if (kind === BuildKind.City) return makeCity(mats);
    return makeSettlement(mats);
  }

  private createGhostMaterials(color: number): PlayerFigureMaterials {
    const bodyColor = new Color(color);
    const body = new MeshStandardMaterial({
      color: bodyColor,
      emissive: bodyColor.clone(),
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: GHOST_OPACITY,
      depthWrite: false,
      flatShading: true,
      roughness: 0.5,
    });
    const accentColor = new Color(color).multiplyScalar(0.75);
    const accent = new MeshStandardMaterial({
      color: accentColor,
      emissive: accentColor.clone(),
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: GHOST_OPACITY,
      depthWrite: false,
      flatShading: true,
      roughness: 0.5,
    });
    // Ghosts use the same emissive accent for "dark" details so doors / windows
    // stay visible inside the translucent silhouette instead of disappearing.
    const darkColor = new Color(color).multiplyScalar(0.55);
    const dark = new MeshStandardMaterial({
      color: darkColor,
      emissive: darkColor.clone(),
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: GHOST_OPACITY,
      depthWrite: false,
      flatShading: true,
      roughness: 0.6,
    });
    return { body, accent, dark };
  }

  private trackGeometries(figure: Group): void {
    figure.traverse((object) => {
      if (object instanceof Mesh) {
        this.trackedGeometries.push(object.geometry as BufferGeometry);
        object.castShadow = false;
        object.receiveShadow = false;
      }
    });
  }
}
