import {
  AdditiveBlending,
  CanvasTexture,
  ConeGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from 'three';

/** Direction the shafts stream in from — matches the key light in lighting.ts. */
const SUN_DIR = new Vector3(14, 24, 10).normalize();
const UP = new Vector3(0, 1, 0);
/** Far point the shafts originate from, so they read as coming from the sun. */
const SUN_ORIGIN = SUN_DIR.clone().multiplyScalar(170);
const SHAFT_COLOR = 0xfff2dc;
const BASE_OPACITY = 0.05;

/** Board landing spots as `[x, z, spread]` — `spread` is the beam width at the table. */
const LANDING_SPOTS: readonly (readonly [number, number, number])[] = [
  [-6, -4, 2.4],
  [-2, 5, 2.8],
  [5, -7, 2.2],
  [8, 4, 2.6],
  [-9, 7, 2.0],
  [1, 0, 3.0],
];

interface Shaft {
  readonly material: MeshBasicMaterial;
  readonly phase: number;
}

/**
 * Vertical alpha falloff so each shaft fades softly into nothing at both ends
 * instead of showing a hard cone edge. `v = 0` is the table end, `v = 1` the
 * far sun end.
 */
function makeFalloffTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.18, 'rgba(255,255,255,1)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1.0, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1, 256);
  }
  return new CanvasTexture(canvas);
}

/**
 * Subtle volumetric light shafts streaming from the distant sun down onto the
 * table. Purely decorative — additive, fog-free, casts no shadow. Each shaft is
 * a long, thin cone anchored at the sun and flaring gently over the board, with
 * a soft alpha falloff so it never reads as a solid wedge. They breathe out of
 * phase so the light feels alive.
 */
export class SunShafts {
  readonly group: Group = new Group();

  private readonly geometry: ConeGeometry;
  private readonly falloff: CanvasTexture;
  private readonly shafts: Shaft[] = [];
  private enabled = true;

  constructor() {
    // Open cone: vanishingly thin tip at the sun, flaring base over the table.
    this.geometry = new ConeGeometry(1, 1, 24, 1, true);
    this.falloff = makeFalloffTexture();

    const orientation = new Quaternion();
    const axis = new Vector3();
    const center = new Vector3();
    const landing = new Vector3();

    for (let i = 0; i < LANDING_SPOTS.length; i += 1) {
      const [x, z, spread] = LANDING_SPOTS[i];
      landing.set(x, 1, z);
      // Cone tip (+Y) points toward the sun; base lands on the table.
      axis.subVectors(SUN_ORIGIN, landing);
      const length = axis.length();
      axis.normalize();
      orientation.setFromUnitVectors(UP, axis);
      center.addVectors(SUN_ORIGIN, landing).multiplyScalar(0.5);

      const material = new MeshBasicMaterial({
        color: SHAFT_COLOR,
        map: this.falloff,
        transparent: true,
        opacity: BASE_OPACITY,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        fog: false,
      });
      const mesh = new Mesh(this.geometry, material);
      mesh.scale.set(spread, length, spread);
      mesh.quaternion.copy(orientation);
      mesh.position.copy(center);
      this.group.add(mesh);
      this.shafts.push({ material, phase: i * 0.9 });
    }
  }

  update(_dt: number, t: number): void {
    if (!this.enabled) {
      return;
    }
    for (let i = 0; i < this.shafts.length; i += 1) {
      const shaft = this.shafts[i];
      const pulse = 0.8 + 0.2 * Math.sin(t * 0.35 + shaft.phase);
      shaft.material.opacity = BASE_OPACITY * pulse;
    }
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) {
      return;
    }
    this.enabled = enabled;
    this.group.visible = enabled;
  }

  dispose(): void {
    this.geometry.dispose();
    this.falloff.dispose();
    for (let i = 0; i < this.shafts.length; i += 1) {
      this.shafts[i].material.dispose();
    }
  }
}
