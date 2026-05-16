import {
  Color,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Shape,
} from 'three';
import { PlayerColor } from './player-color.enum';

const HALF_PAD_X = 5.12;
const HALF_PAD_Z = 0.64;
const CORNER_R = 0.14;
const EXTRUDE_DEPTH = 0.02;
const CENTER_X = -2.12;
const INNER_EDGE_PAD_Z = 0.6;

export class PlayerAreaSelfPad {
  readonly group: Group = new Group();

  private readonly mainMaterial: MeshStandardMaterial;
  private readonly pulseBase: number;
  private pulsePhase = 0;
  private visibleTarget = false;

  public constructor(color: PlayerColor, tableTopY: number, innerEdgeZ: number) {
    const accent = PlayerAreaSelfPad.accentColor(color);
    this.pulseBase = PlayerAreaSelfPad.pulseStrength(color);
    this.mainMaterial = new MeshStandardMaterial({
      color: 0x141822,
      roughness: 0.88,
      metalness: 0.08,
      emissive: accent,
      emissiveIntensity: this.pulseBase,
    });

    const mesh = new Mesh(PlayerAreaSelfPad.createPadGeometry(), this.mainMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    this.group.add(mesh);

    this.group.position.set(CENTER_X, tableTopY - EXTRUDE_DEPTH / 2, innerEdgeZ + INNER_EDGE_PAD_Z);
    this.group.visible = false;
  }

  public setActive(active: boolean): void {
    this.visibleTarget = active;
    this.group.visible = active;
    if (!active) {
      this.mainMaterial.emissiveIntensity = this.pulseBase;
    }
  }

  public update(dt: number): void {
    if (!this.visibleTarget) {
      return;
    }
    this.pulsePhase += dt;
    const pulse = Math.sin(this.pulsePhase * 1.35) * 0.042;
    this.mainMaterial.emissiveIntensity = Math.max(0.04, this.pulseBase + pulse);
  }

  public dispose(): void {
    const mesh = this.group.children[0] as Mesh | undefined;
    if (mesh) {
      mesh.geometry.dispose();
    }
    this.mainMaterial.dispose();
  }

  private static accentColor(color: PlayerColor): Color {
    const hex = color as number;
    const r = ((hex >> 16) & 255) / 255;
    const g = ((hex >> 8) & 255) / 255;
    const b = (hex & 255) / 255;
    if (color === PlayerColor.White) {
      return new Color(0.72, 0.76, 0.98);
    }
    const c = new Color(r * 0.55 + 0.12, g * 0.55 + 0.1, b * 0.55 + 0.14);
    const len = Math.sqrt(c.r * c.r + c.g * c.g + c.b * c.b) || 1;
    return c.setRGB(c.r / len, c.g / len, c.b / len);
  }

  private static pulseStrength(color: PlayerColor): number {
    if (color === PlayerColor.White) {
      return 0.11;
    }
    return 0.13;
  }

  private static createPadGeometry(): ExtrudeGeometry {
    const hw = HALF_PAD_X;
    const hd = HALF_PAD_Z;
    const r = CORNER_R;
    const s = new Shape();
    s.moveTo(-hw + r, -hd);
    s.lineTo(hw - r, -hd);
    s.quadraticCurveTo(hw, -hd, hw, -hd + r);
    s.lineTo(hw, hd - r);
    s.quadraticCurveTo(hw, hd, hw - r, hd);
    s.lineTo(-hw + r, hd);
    s.quadraticCurveTo(-hw, hd, -hw, hd - r);
    s.lineTo(-hw, -hd + r);
    s.quadraticCurveTo(-hw, -hd, -hw + r, -hd);

    return new ExtrudeGeometry(s, {
      depth: EXTRUDE_DEPTH,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.008,
      bevelSegments: 2,
      curveSegments: 16,
    });
  }
}
