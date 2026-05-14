import { BoxGeometry, Material, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { makeDieFaceTexture } from './textures';

export type DieState = 'idle' | 'rolling' | 'settled';

/**
 * Material order for BoxGeometry is +X, -X, +Y, -Y, +Z, -Z. We assign opposite
 * faces so they sum to seven, matching a real Western die.
 */
const FACE_VALUES: readonly number[] = [1, 6, 2, 5, 3, 4];

const FACE_NORMALS: readonly (readonly [number, number, number])[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

const ROLL_DURATION_S = 1.4;
const SPIN_PHASE = 0.75; // 0..SPIN_PHASE = freely tumbling; rest = settle.
const HOP_HEIGHT = 0.9;

export interface DieOptions {
  readonly size: number;
  /** World position (centre) where the die rests when idle. */
  readonly restPosition: Vector3;
}

export class Die {
  readonly mesh: Mesh;
  readonly size: number;
  readonly restPosition: Vector3;

  private state: DieState = 'idle';
  private animT = 0;
  private value = 1;
  private targetValue = 1;
  private readonly startQuat = new Quaternion();
  private readonly tumbleAxis = new Vector3();
  private tumbleSpeed = 0;
  private readonly settleStartQuat = new Quaternion();
  private readonly settleEndQuat = new Quaternion();
  private settleStartCaptured = false;

  private readonly ownedMaterials: MeshStandardMaterial[] = [];

  constructor(options: DieOptions) {
    this.size = options.size;
    this.restPosition = options.restPosition.clone();

    const mats: Material[] = FACE_VALUES.map((v) => {
      const tex = makeDieFaceTexture(v);
      const mat = new MeshStandardMaterial({
        map: tex,
        roughness: 0.55,
        metalness: 0.05,
      });
      this.ownedMaterials.push(mat);
      return mat;
    });

    const geom = new BoxGeometry(options.size, options.size, options.size);
    this.mesh = new Mesh(geom, mats);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.position.copy(this.restPosition);
    this.mesh.userData['kind'] = 'die';
    this.mesh.userData['die'] = this;

    // Start showing a 1.
    this.applyValueOrientation(1);
  }

  /** Currently showing face. Stable while idle/settled, undefined-ish while rolling. */
  getValue(): number {
    return this.value;
  }

  isRolling(): boolean {
    return this.state === 'rolling';
  }

  /** Begin a tumble. Resolves to the settled value (1..6). */
  beginRoll(targetValue: number): void {
    this.targetValue = clampDie(targetValue);
    this.state = 'rolling';
    this.animT = 0;
    this.settleStartCaptured = false;
    this.startQuat.copy(this.mesh.quaternion);

    // Random axis for the spin phase, biased away from purely vertical so the
    // tumble looks chaotic in 3D rather than a flat spin.
    const ax = randomSigned();
    const ay = randomSigned() * 0.6;
    const az = randomSigned();
    this.tumbleAxis.set(ax, ay, az).normalize();
    // Several full revolutions over the spin phase.
    const spins = 3 + Math.random() * 2;
    this.tumbleSpeed = (spins * Math.PI * 2) / (ROLL_DURATION_S * SPIN_PHASE);
  }

  update(dt: number): void {
    if (this.state !== 'rolling') return;

    this.animT = Math.min(1, this.animT + dt / ROLL_DURATION_S);
    const t = this.animT;

    if (t < SPIN_PHASE) {
      const u = t / SPIN_PHASE;
      // Tumble: rotate freely around tumbleAxis at decaying speed.
      const angle = this.tumbleSpeed * t * (1 - 0.4 * u);
      const spin = new Quaternion().setFromAxisAngle(this.tumbleAxis, angle);
      this.mesh.quaternion.copy(spin).multiply(this.startQuat);
      // Parabolic hop while spinning.
      const hop = 4 * u * (1 - u) * HOP_HEIGHT;
      this.mesh.position.set(this.restPosition.x, this.restPosition.y + hop, this.restPosition.z);
    } else {
      if (!this.settleStartCaptured) {
        this.settleStartQuat.copy(this.mesh.quaternion);
        this.settleEndQuat.copy(this.computeOrientationFor(this.targetValue));
        this.settleStartCaptured = true;
      }
      const u = (t - SPIN_PHASE) / (1 - SPIN_PHASE);
      const e = easeOutCubic(u);
      this.mesh.quaternion.slerpQuaternions(this.settleStartQuat, this.settleEndQuat, e);
      // Tail-end of the hop drops the die back onto the table.
      const drop = (1 - e) * 0.15;
      this.mesh.position.set(this.restPosition.x, this.restPosition.y + drop, this.restPosition.z);
    }

    if (this.animT >= 1) {
      this.mesh.position.copy(this.restPosition);
      this.mesh.quaternion.copy(this.computeOrientationFor(this.targetValue));
      this.value = this.targetValue;
      this.state = 'settled';
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    for (const m of this.ownedMaterials) {
      m.map?.dispose();
      m.dispose();
    }
  }

  /** Snap the orientation so the requested value sits on top. Resets to idle. */
  private applyValueOrientation(value: number): void {
    this.mesh.quaternion.copy(this.computeOrientationFor(value));
    this.value = value;
    this.state = 'idle';
  }

  private computeOrientationFor(value: number): Quaternion {
    // Pick the local face whose value matches and rotate it onto +Y world.
    const faceIdx = FACE_VALUES.indexOf(value);
    const [nx, ny, nz] = FACE_NORMALS[faceIdx];
    const faceUp = new Quaternion().setFromUnitVectors(
      new Vector3(nx, ny, nz),
      new Vector3(0, 1, 0),
    );
    // Random rotation around world Y so the die doesn't always land in the
    // exact same yaw — purely cosmetic.
    const yaw = Math.random() * Math.PI * 2;
    const yawQ = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw);
    return yawQ.multiply(faceUp);
  }
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function randomSigned(): number {
  return Math.random() * 2 - 1;
}

function clampDie(v: number): number {
  if (v < 1) return 1;
  if (v > 6) return 6;
  return Math.round(v);
}
