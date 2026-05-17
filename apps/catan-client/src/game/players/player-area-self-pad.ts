import {
  CanvasTexture,
  ClampToEdgeWrapping,
  Color,
  Group,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  Shape,
  ShapeGeometry,
} from 'three';
import { PlayerColor } from './player-color.enum';

const FELT_HALF_X = 5.25;
const FELT_HALF_Z = 0.78;
const FELT_CORNER_R = 0.22;
const FELT_LIFT = 0.0035;
const FELT_TEXTURE_SIZE = 512;
const CENTER_X = -2.12;
const INNER_EDGE_PAD_Z = 0.58;

export class PlayerAreaSelfPad {
  readonly group: Group = new Group();

  private readonly accentColor: Color;
  private readonly feltTexture: CanvasTexture;
  private readonly mainMaterial: MeshStandardMaterial;
  private active = false;

  public constructor(color: PlayerColor, tableTopY: number, innerEdgeZ: number) {
    this.accentColor = PlayerAreaSelfPad.feltAccentColor(color);
    this.feltTexture = PlayerAreaSelfPad.buildFeltTexture(color);
    this.mainMaterial = new MeshStandardMaterial({
      map: this.feltTexture,
      color: new Color(1, 1, 1),
      roughness: 0.96,
      metalness: 0,
      emissive: this.accentColor,
      emissiveIntensity: 0,
      flatShading: false,
    });

    const mesh = new Mesh(PlayerAreaSelfPad.createFeltGeometry(), this.mainMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    this.group.add(mesh);

    this.group.position.set(CENTER_X, tableTopY + FELT_LIFT, innerEdgeZ + INNER_EDGE_PAD_Z);
    this.applyMaterialState();
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public setActive(active: boolean): void {
    if (active === this.active) {
      return;
    }
    this.active = active;
    this.applyMaterialState();
  }

  public update(_dt: number): void {
    return;
  }

  public dispose(): void {
    const mesh = this.group.children[0] as Mesh | undefined;
    if (mesh) {
      mesh.geometry.dispose();
    }
    this.feltTexture.dispose();
    this.mainMaterial.dispose();
  }

  private applyMaterialState(): void {
    if (this.active) {
      this.mainMaterial.color.setRGB(1.06, 1.06, 1.06);
      this.mainMaterial.roughness = 0.92;
      this.mainMaterial.emissiveIntensity = 0.045;
      return;
    }
    this.mainMaterial.color.setRGB(1, 1, 1);
    this.mainMaterial.roughness = 0.96;
    this.mainMaterial.emissiveIntensity = 0;
  }

  private static feltBaseColor(color: PlayerColor): Color {
    const base = new Color(color as number);
    if (color === PlayerColor.White) {
      return new Color(0.78, 0.8, 0.86);
    }
    return base.clone().multiplyScalar(0.62);
  }

  private static feltAccentColor(color: PlayerColor): Color {
    const base = new Color(color as number);
    if (color === PlayerColor.White) {
      return new Color(0.55, 0.6, 0.78);
    }
    return base.clone().multiplyScalar(0.85);
  }

  private static buildFeltTexture(color: PlayerColor): CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = FELT_TEXTURE_SIZE;
    canvas.height = FELT_TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');
    if (ctx === null) {
      const fallback = new CanvasTexture(canvas);
      fallback.colorSpace = SRGBColorSpace;
      return fallback;
    }

    const felt = PlayerAreaSelfPad.feltBaseColor(color);
    const r = Math.round(felt.r * 255);
    const g = Math.round(felt.g * 255);
    const b = Math.round(felt.b * 255);
    const size = FELT_TEXTURE_SIZE;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.48;

    const baseFill = ctx.createRadialGradient(cx, cy, radius * 0.12, cx, cy, radius);
    baseFill.addColorStop(0, `rgb(${Math.min(255, r + 18)}, ${Math.min(255, g + 18)}, ${Math.min(255, b + 18)})`);
    baseFill.addColorStop(0.72, `rgb(${r}, ${g}, ${b})`);
    baseFill.addColorStop(1, `rgb(${Math.max(0, r - 32)}, ${Math.max(0, g - 32)}, ${Math.max(0, b - 32)})`);
    ctx.fillStyle = baseFill;
    ctx.fillRect(0, 0, size, size);

    const weave = ctx.createImageData(size, size);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) / radius;
        if (dist > 1.02) {
          continue;
        }
        const idx = (y * size + x) * 4;
        const grain =
          ((x * 17 + y * 31) % 97) / 97 * 0.5 +
          ((x * 7 - y * 13) % 53) / 53 * 0.5;
        const vignette = Math.max(0, (dist - 0.55) / 0.45);
        const delta = (grain - 0.5) * 14 - vignette * 22;
        weave.data[idx] = Math.max(0, Math.min(255, r + delta));
        weave.data[idx + 1] = Math.max(0, Math.min(255, g + delta));
        weave.data[idx + 2] = Math.max(0, Math.min(255, b + delta));
        weave.data[idx + 3] = Math.round((1 - Math.max(0, dist - 1) * 6) * 255);
      }
    }
    ctx.putImageData(weave, 0, 0);

    const edge = PlayerAreaSelfPad.feltAccentColor(color);
    const er = Math.round(edge.r * 255);
    const eg = Math.round(edge.g * 255);
    const eb = Math.round(edge.b * 255);
    ctx.strokeStyle = `rgba(${er}, ${eg}, ${eb}, 0.55)`;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(${Math.max(0, er - 40)}, ${Math.max(0, eg - 40)}, ${Math.max(0, eb - 40)}, 0.35)`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 14, 0, Math.PI * 2);
    ctx.stroke();

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearFilter;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
  }

  private static createFeltGeometry(): ShapeGeometry {
    const hw = FELT_HALF_X;
    const hd = FELT_HALF_Z;
    const r = FELT_CORNER_R;
    const shape = new Shape();
    shape.moveTo(-hw + r, -hd);
    shape.lineTo(hw - r, -hd);
    shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
    shape.lineTo(hw, hd - r);
    shape.quadraticCurveTo(hw, hd, hw - r, hd);
    shape.lineTo(-hw + r, hd);
    shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
    shape.lineTo(-hw, -hd + r);
    shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
    return new ShapeGeometry(shape, 24);
  }
}
