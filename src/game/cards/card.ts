import {
  BoxGeometry,
  Color,
  Material,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { CardHoverInfo } from '../shared/card-hover';

export type CardMode = 'rest' | 'focused';

export interface CardOptions {
  /** Long side of the card (mapped to local Z). */
  readonly width: number;
  /** Short side (mapped to local X). */
  readonly height: number;
  /** Card thickness (mapped to local Y). */
  readonly thickness: number;
  readonly backMaterial: MeshStandardMaterial;
  readonly faceMaterial: MeshStandardMaterial;
  readonly edgeMaterial: MeshStandardMaterial;
  readonly hoverInfo?: CardHoverInfo;
}

export interface CardLocalSize {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** How far the card lifts upward when hovered in rest mode. */
const HOVER_LIFT = 0.42;

/**
 * A 3-D card lying flat on the table. Click to focus: the engine drives the
 * card's pose each frame so it (and its group siblings) float in front of the
 * camera, face-on and large enough to read. Hovering an unfocused card lifts
 * it slightly so overlapping siblings are revealable.
 */
export class Card {
  readonly mesh: Mesh;
  private readonly basePos = new Vector3();
  private readonly baseQuat = new Quaternion();
  private mode: CardMode = 'rest';
  private hovered = false;
  private readonly liveTargetPos = new Vector3();
  private readonly liveTargetQuat = new Quaternion();
  private readonly allMaterials: MeshStandardMaterial[];
  private readonly texturedMaterials: MeshStandardMaterial[];
  private readonly originalDepthTest: boolean;
  private readonly originalDepthWrite: boolean;
  private readonly localSize: CardLocalSize;
  private readonly hoverInfo: CardHoverInfo | null;
  private groupKey: string | null = null;

  constructor(options: CardOptions) {
    const { width, height, thickness, backMaterial, faceMaterial, edgeMaterial } = options;
    // BoxGeometry material order: +X, -X, +Y, -Y, +Z, -Z. The face lives on -Y;
    // in focus mode the engine rotates the card so -Y points at the camera.
    const mats: Material[] = [
      edgeMaterial,
      edgeMaterial,
      backMaterial,
      faceMaterial,
      edgeMaterial,
      edgeMaterial,
    ];
    this.mesh = new Mesh(new BoxGeometry(height, thickness, width), mats);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.userData['kind'] = 'card';
    this.mesh.userData['card'] = this;

    this.allMaterials = [backMaterial, faceMaterial, edgeMaterial];
    this.texturedMaterials = [backMaterial, faceMaterial];
    this.originalDepthTest = backMaterial.depthTest;
    this.originalDepthWrite = backMaterial.depthWrite;
    this.localSize = { x: height, y: thickness, z: width };
    this.hoverInfo = options.hoverInfo ?? null;
  }

  /** Set the card's resting pose. Call before adding it to the scene. */
  setBasePose(position: Vector3, quaternion: Quaternion): void {
    this.basePos.copy(position);
    this.baseQuat.copy(quaternion);
    this.mesh.position.copy(position);
    this.mesh.quaternion.copy(quaternion);
    this.recomputeRestTarget();
  }

  /**
   * Cards that share the same group key focus together: clicking one fans
   * them all out in front of the camera. `null` means "lonely" — only this
   * card focuses on its own click.
   */
  setGroupKey(key: string | null): void {
    this.groupKey = key;
  }

  getGroupKey(): string | null {
    return this.groupKey;
  }

  /** Local geometry size: x (short, screen-horizontal in focus), z (long, screen-vertical). */
  getLocalSize(): CardLocalSize {
    return this.localSize;
  }

  toggle(): void {
    this.setMode(this.mode === 'rest' ? 'focused' : 'rest');
  }

  setMode(mode: CardMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    if (mode === 'rest') {
      this.recomputeRestTarget();
      this.applyOverlayVisuals(false);
    } else {
      this.applyOverlayVisuals(true);
    }
  }

  isFocused(): boolean {
    return this.mode === 'focused';
  }

  getHoverInfo(): CardHoverInfo | null {
    return this.hoverInfo;
  }

  /**
   * Hover state — only meaningful in rest mode (focus mode ignores it). When
   * hovered, the card's resting target lifts upward in world Y so overlapping
   * siblings reveal what's underneath.
   */
  setHovered(hovered: boolean): void {
    if (this.hovered === hovered) return;
    this.hovered = hovered;
    if (this.mode === 'rest') this.recomputeRestTarget();
  }

  /**
   * Engine call while the card is focused: report the desired pose in this
   * card's parent-local space. Card lerps toward it.
   */
  setLiveTarget(position: Vector3, quaternion: Quaternion): void {
    this.liveTargetPos.copy(position);
    this.liveTargetQuat.copy(quaternion);
  }

  update(dt: number): void {
    // Critically-damped lerp toward the live target — works for both the
    // returning-to-rest case and the engine-driven focused case.
    const a = 1 - Math.exp(-dt * 9);
    this.mesh.position.lerp(this.liveTargetPos, a);
    this.mesh.quaternion.slerp(this.liveTargetQuat, a);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    // Materials are shared per player area and disposed there.
  }

  private recomputeRestTarget(): void {
    this.liveTargetPos.copy(this.basePos);
    if (this.hovered) this.liveTargetPos.y += HOVER_LIFT;
    this.liveTargetQuat.copy(this.baseQuat);
  }

  /**
   * Focused cards must render on top of every other 3-D element so they read
   * cleanly even while travelling across the disc, tiles or table. The
   * emissive boost ensures they're bright regardless of sun direction —
   * otherwise the camera-facing side would be lit only by ambient + hemi.
   */
  private applyOverlayVisuals(focused: boolean): void {
    this.mesh.castShadow = !focused;
    this.mesh.renderOrder = focused ? 999 : 0;
    for (const m of this.allMaterials) {
      m.depthTest = focused ? false : this.originalDepthTest;
      m.depthWrite = focused ? false : this.originalDepthWrite;
      m.needsUpdate = true;
    }
    for (const m of this.texturedMaterials) {
      if (focused) {
        m.emissive = new Color(0xffffff);
        m.emissiveMap = m.map;
        m.emissiveIntensity = 0.7;
      } else {
        m.emissive = new Color(0x000000);
        m.emissiveMap = null;
        m.emissiveIntensity = 0;
      }
      m.needsUpdate = true;
    }
  }
}
