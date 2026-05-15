import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { AxialCoord, HEX_SIZE } from '../board/hex';
import { TILE_COLOR, TileType } from '@catan/shared-game-field';
import { SceneObjectKind, SceneUserDataKey } from '@catan/api-interfaces';

export interface TileInit {
  readonly coord: AxialCoord;
  readonly type: TileType;
  readonly position: Vector3;
  readonly number: number | null;
}

/** Land tiles sit thick like an island slab so the cliff face is visible. */
export const TILE_HEIGHT = 1.0;
/** Orbital height of the number-chip balloons — sits well above any decoration. */
export const CHIP_FLOAT_Y = TILE_HEIGHT + 4.45;
/** World Y at which the water surface sits (lower than tile top → visible cliff). */
export const WATER_LEVEL_Y = -0.4;

const CHIP_BALLOON_REF_BASE_SCALE = 0.55;
const CHIP_BALLOON_REF_HOVER_SCALE = 1.15;
const CHIP_BALLOON_REF_BASE_OPACITY = 0.4;
const CHIP_BALLOON_REF_HOVER_OPACITY = 0.95;
const CHIP_BALLOON_VISUAL_UPSCALE = 1.52;

const CHIP_BASE_SCALE = CHIP_BALLOON_REF_BASE_SCALE * CHIP_BALLOON_VISUAL_UPSCALE;
const CHIP_HOVER_SCALE =
  CHIP_BASE_SCALE * (CHIP_BALLOON_REF_HOVER_SCALE / CHIP_BALLOON_REF_BASE_SCALE);
const CHIP_BASE_OPACITY = CHIP_BALLOON_REF_BASE_OPACITY;
const CHIP_HOVER_OPACITY = CHIP_BALLOON_REF_HOVER_OPACITY;

/**
 * Base for one hex on the board. Subclasses add decorations and animation,
 * and must call `super.update(dt, t)` to keep the chip balloon bobbing.
 */
export abstract class Tile {
  readonly group: Group = new Group();
  readonly coord: AxialCoord;
  readonly type: TileType;
  readonly number: number | null;
  /** Becomes true when a player has built adjacent. */
  settled = false;

  private chipSprite: Sprite | null = null;
  private chipBeam: Mesh | null = null;
  private chipBeamMaterial: MeshBasicMaterial | null = null;
  private chipPhase = 0;
  private chipHoverT = 0;

  constructor(init: TileInit) {
    this.coord = init.coord;
    this.type = init.type;
    this.number = init.number;
    this.group.position.copy(init.position);
    this.buildBase();
    this.buildOutline();
    if (init.number !== null) this.buildNumberBalloon(init.number);
  }

  private buildBase(): void {
    // Slab top at TILE_HEIGHT; bottom extends well below the water surface so the
    // underside is hidden regardless of waves.
    const slabHeight = TILE_HEIGHT - WATER_LEVEL_Y + 2.0;
    const geom = new CylinderGeometry(HEX_SIZE, HEX_SIZE, slabHeight, 6, 1);
    const mat = new MeshStandardMaterial({
      color: TILE_COLOR[this.type],
      flatShading: true,
      roughness: 0.95,
      metalness: 0.0,
    });
    const mesh = new Mesh(geom, mat);
    mesh.position.y = TILE_HEIGHT - slabHeight / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  /** Dark hex outline on the tile rim to make borders pop. */
  private buildOutline(): void {
    const points: number[] = [];
    // CylinderGeometry(R, R, h, 6) places vertices at (sin θ, *, cos θ) — pointy-top.
    for (let i = 0; i <= 6; i++) {
      const theta = (i / 6) * Math.PI * 2;
      points.push(HEX_SIZE * Math.sin(theta), TILE_HEIGHT + 0.01, HEX_SIZE * Math.cos(theta));
    }
    const geom = new BufferGeometry();
    geom.setAttribute('position', new Float32BufferAttribute(points, 3));
    const mat = new LineBasicMaterial({ color: 0x1d130a, transparent: true, opacity: 0.55 });
    this.group.add(new Line(geom, mat));
  }

  private buildNumberBalloon(value: number): void {
    const tex = makeChipTexture(value);
    const material = new SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: CHIP_BASE_OPACITY,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
    });
    const sprite = new Sprite(material);
    sprite.scale.set(CHIP_BASE_SCALE, CHIP_BASE_SCALE, 1);
    sprite.position.set(0, CHIP_FLOAT_Y, 0);
    sprite.userData[SceneUserDataKey.Kind] = SceneObjectKind.Chip;
    sprite.userData[SceneUserDataKey.Tile] = this;
    this.group.add(sprite);
    this.chipSprite = sprite;
    this.chipPhase = (this.coord.q * 0.9 + this.coord.r * 1.7) % (Math.PI * 2);

    const beamBottomY = TILE_HEIGHT + 0.02;
    const beamTopY = CHIP_FLOAT_Y - 0.06;
    const beamHeight = beamTopY - beamBottomY;
    const beamRadius = 0.048;
    const beamGeom = new CylinderGeometry(beamRadius, beamRadius, beamHeight, 10, 1);
    const beamMat = new MeshBasicMaterial({
      color: value === 6 || value === 8 ? 0xffc8b8 : 0xc8e8f2,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const beamMesh = new Mesh(beamGeom, beamMat);
    beamMesh.position.y = beamBottomY + beamHeight / 2;
    this.chipBeam = beamMesh;
    this.chipBeamMaterial = beamMat;
    this.group.add(beamMesh);
  }

  /** Sprite for raycast hover detection. */
  getChipSprite(): Sprite | null {
    return this.chipSprite;
  }

  /** Called by the hover system. */
  setChipHovered(hovered: boolean): void {
    this.chipHoverT = hovered
      ? Math.min(1, this.chipHoverT + 0.1)
      : Math.max(0, this.chipHoverT - 0.1);
  }

  /** Subclasses must call super.update(dt, t). */
  update(dt: number, t: number): void {
    if (this.chipSprite) {
      const targetT = this.chipHoverT;
      const eased = easeOutCubic(targetT);
      const scale = CHIP_BASE_SCALE + (CHIP_HOVER_SCALE - CHIP_BASE_SCALE) * eased;
      this.chipSprite.scale.set(scale, scale, 1);
      // Slow drifty bob — orbital balloon feel.
      const bob = Math.sin(t * 0.55 + this.chipPhase) * 0.12;
      this.chipSprite.position.y = CHIP_FLOAT_Y + bob;
      this.chipSprite.material.opacity =
        CHIP_BASE_OPACITY + (CHIP_HOVER_OPACITY - CHIP_BASE_OPACITY) * eased;
      if (this.chipBeamMaterial) {
        this.chipBeamMaterial.opacity = 0.14 + 0.32 * eased;
      }
      // Decay hover unless refreshed by the hover system this frame.
      this.chipHoverT = Math.max(0, this.chipHoverT - dt * 4);
    }
  }

  dispose(): void {
    this.group.traverse((obj) => {
      if (obj instanceof Mesh) {
        obj.geometry.dispose();
        const mat = obj.material;
        const list = Array.isArray(mat) ? mat : [mat];
        for (const m of list) m.dispose();
      }
      if (obj instanceof Line) {
        obj.geometry.dispose();
        const m = obj.material;
        if (!Array.isArray(m)) m.dispose();
      }
    });
    if (this.chipSprite) {
      this.chipSprite.material.map?.dispose();
      this.chipSprite.material.dispose();
    }
  }
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function makeChipTexture(value: number): CanvasTexture {
  const size = 512;
  const mid = size / 2;
  const ringRadius = (size / 2) * (92 / 128);
  const fontPx = Math.round(148 * (size / 256));
  const ringLineWidth = 3.5 * (size / 256);
  const digitStrokeWidth = Math.max(2, 2.25 * (size / 256));
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to obtain 2D canvas context for chip texture.');

  const hot = value === 6 || value === 8;
  const accent = hot ? 'rgba(255, 165, 135, 1)' : 'rgba(200, 248, 255, 1)';
  const glow = hot ? 'rgba(255, 190, 155, 0.88)' : 'rgba(200, 248, 255, 0.88)';

  ctx.shadowBlur = 12 * (size / 256);
  ctx.shadowColor = glow;
  ctx.strokeStyle = accent;
  ctx.lineWidth = ringLineWidth;
  ctx.beginPath();
  ctx.arc(mid, mid, ringRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.shadowColor = 'rgba(0, 0, 0, 0)';
  ctx.font = `700 ${fontPx}px "Inter", "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = digitStrokeWidth;
  ctx.strokeStyle = hot ? 'rgba(90, 35, 28, 0.45)' : 'rgba(35, 55, 62, 0.42)';
  ctx.strokeText(String(value), mid, mid);
  ctx.fillStyle = accent;
  ctx.fillText(String(value), mid, mid);

  const tex = new CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}
