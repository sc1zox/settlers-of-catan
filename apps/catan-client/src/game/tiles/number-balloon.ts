import {
  CanvasTexture,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  Sprite,
  SpriteMaterial,
} from 'three';
import { SceneObjectKind, SceneUserDataKey } from '@catan/api-interfaces';
import { AxialCoord } from '../board/hex';
import { CHIP_FLOAT_Y, TILE_HEIGHT } from './tile-metrics';
import type { Tile } from './tile';

const CHIP_BALLOON_REF_BASE_SCALE = 0.55;
const CHIP_BALLOON_REF_HOVER_SCALE = 1.15;
const CHIP_BALLOON_REF_BASE_OPACITY = 0.74;
const CHIP_BALLOON_REF_HOVER_OPACITY = 0.95;
const CHIP_BALLOON_VISUAL_UPSCALE = 1.62;

const CHIP_BASE_SCALE = CHIP_BALLOON_REF_BASE_SCALE * CHIP_BALLOON_VISUAL_UPSCALE;
const CHIP_HOVER_SCALE =
  CHIP_BASE_SCALE * (CHIP_BALLOON_REF_HOVER_SCALE / CHIP_BALLOON_REF_BASE_SCALE);
const CHIP_BASE_OPACITY = CHIP_BALLOON_REF_BASE_OPACITY;
const CHIP_HOVER_OPACITY = CHIP_BALLOON_REF_HOVER_OPACITY;
const CHIP_ROLLED_SCALE_BOOST = 0.32;
const CHIP_ROLLED_LIFT = 1.35;
const CHIP_ROLLED_BEAM_BOOST = 0.32;

export interface NumberBalloonOptions {
  readonly value: number;
  readonly coord: AxialCoord;
  readonly tile: Tile;
}

/**
 * Floating number chip + light beam on a land hex. One instance per numbered tile.
 * Hover and rolled-highlight state are driven by {@link HoverSystem} and {@link Board}.
 */
export class NumberBalloon {
  readonly group: Group = new Group();
  readonly value: number;

  private readonly sprite: Sprite;
  private readonly beamMaterial: MeshBasicMaterial;
  private readonly phase: number;
  private hoverT = 0;
  private pointerHovered = false;
  private rolledHighlighted = false;

  public constructor(parent: Group, options: NumberBalloonOptions) {
    this.value = options.value;
    this.phase = (options.coord.q * 0.9 + options.coord.r * 1.7) % (Math.PI * 2);

    const tex = makeChipTexture(options.value);
    const material = new SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: CHIP_BASE_OPACITY,
      depthWrite: false,
      depthTest: true,
      blending: NormalBlending,
    });
    this.sprite = new Sprite(material);
    this.sprite.scale.set(CHIP_BASE_SCALE, CHIP_BASE_SCALE, 1);
    this.sprite.position.set(0, CHIP_FLOAT_Y, 0);
    this.sprite.userData[SceneUserDataKey.Kind] = SceneObjectKind.Chip;
    this.sprite.userData[SceneUserDataKey.Tile] = options.tile;
    this.group.add(this.sprite);

    const beamBottomY = TILE_HEIGHT + 0.02;
    const beamTopY = CHIP_FLOAT_Y - 0.06;
    const beamHeight = beamTopY - beamBottomY;
    const beamRadius = 0.048;
    const beamGeom = new CylinderGeometry(beamRadius, beamRadius, beamHeight, 10, 1);
    this.beamMaterial = new MeshBasicMaterial({
      color: options.value === 6 || options.value === 8 ? 0xffc8b8 : 0xc8e8f2,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      blending: NormalBlending,
    });
    const beamMesh = new Mesh(beamGeom, this.beamMaterial);
    beamMesh.position.y = beamBottomY + beamHeight / 2;
    this.group.add(beamMesh);

    parent.add(this.group);
  }

  public getPickSprite(): Sprite {
    return this.sprite;
  }

  public setPointerHovered(hovered: boolean): void {
    this.pointerHovered = hovered;
  }

  public setRolledHighlighted(active: boolean): void {
    this.rolledHighlighted = active;
  }

  public update(dt: number, t: number): void {
    const hoverEased = easeOutCubic(this.hoverT);
    const rolledEased = this.rolledHighlighted ? 1 : 0;
    const emphasis = Math.max(hoverEased, rolledEased);
    const baseScale = CHIP_BASE_SCALE + (CHIP_HOVER_SCALE - CHIP_BASE_SCALE) * emphasis;
    const pulse = 1 + Math.sin(t * 5.5) * 0.06 * rolledEased;
    const scale = baseScale * (1 + CHIP_ROLLED_SCALE_BOOST * rolledEased) * pulse;
    this.sprite.scale.set(scale, scale, 1);
    const bob = Math.sin(t * 0.55 + this.phase) * 0.12;
    const lift = CHIP_ROLLED_LIFT * rolledEased;
    this.sprite.position.y = CHIP_FLOAT_Y + bob + lift;
    this.sprite.material.opacity =
      CHIP_BASE_OPACITY + (CHIP_HOVER_OPACITY - CHIP_BASE_OPACITY) * emphasis;
    this.beamMaterial.opacity = 0.26 + 0.34 * emphasis + CHIP_ROLLED_BEAM_BOOST * rolledEased;
    if (this.pointerHovered) {
      this.hoverT = Math.min(1, this.hoverT + dt * 8);
    } else {
      this.hoverT = Math.max(0, this.hoverT - dt * 4);
    }
  }

  public dispose(): void {
    this.group.removeFromParent();
    this.sprite.material.map?.dispose();
    this.sprite.material.dispose();
    for (let i = 0; i < this.group.children.length; i += 1) {
      const child = this.group.children[i];
      if (child instanceof Mesh) {
        child.geometry.dispose();
        const mat = child.material;
        if (!Array.isArray(mat)) {
          mat.dispose();
        }
      }
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
  const ringLineWidth = 4.85 * (size / 256);
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
