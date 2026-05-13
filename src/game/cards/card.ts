import {
  BoxGeometry,
  Material,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';

const FLIP_DURATION_S = 0.45;
const LIFT_Y = 1.2;
const TILT_X_REVEAL = -0.35; // small tilt toward the player so the face reads better

export type CardState = 'down' | 'flipping_up' | 'up' | 'flipping_down';

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
}

/**
 * A 3-D card lying flat on the table. Face-down by default; click to lift it up
 * and rotate so the face shows. Click again to put it back.
 */
export class Card {
  readonly mesh: Mesh;
  private state: CardState = 'down';
  private animT = 0;
  private readonly basePos = new Vector3();
  private readonly baseQuat = new Quaternion();
  private readonly upPos = new Vector3();
  private readonly upQuat = new Quaternion();
  private readonly startPos = new Vector3();
  private readonly startQuat = new Quaternion();
  /** Quaternion rotating 180° around local X — flips the card face-up. */
  private static readonly FLIP_X = new Quaternion().setFromAxisAngle(
    new Vector3(1, 0, 0),
    Math.PI,
  );
  /** Small recovery tilt so the face leans toward the camera when revealed. */
  private static readonly TILT = new Quaternion().setFromAxisAngle(
    new Vector3(1, 0, 0),
    TILT_X_REVEAL,
  );

  constructor(options: CardOptions) {
    const { width, height, thickness, backMaterial, faceMaterial, edgeMaterial } = options;
    // BoxGeometry material order: +X, -X, +Y, -Y, +Z, -Z. With the card lying
    // flat on the table the back is on +Y (visible from above when face-down)
    // and the face on -Y (revealed after a 180° flip around X).
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
  }

  /** Set the card's resting pose. Call before adding it to the scene. */
  setBasePose(position: Vector3, quaternion: Quaternion): void {
    this.basePos.copy(position);
    this.baseQuat.copy(quaternion);
    this.mesh.position.copy(position);
    this.mesh.quaternion.copy(quaternion);

    this.upPos.copy(position);
    this.upPos.y += LIFT_Y;

    // base * flip * tilt — flip first, then tilt slightly back toward player.
    this.upQuat.copy(quaternion).multiply(Card.FLIP_X).multiply(Card.TILT);
  }

  toggle(): void {
    if (this.state === 'down' || this.state === 'flipping_down') {
      this.beginTransition('flipping_up');
    } else {
      this.beginTransition('flipping_down');
    }
  }

  /** True when the card is up or on its way up. */
  isRevealed(): boolean {
    return this.state === 'up' || this.state === 'flipping_up';
  }

  update(dt: number): void {
    if (this.state !== 'flipping_up' && this.state !== 'flipping_down') return;
    this.animT = Math.min(1, this.animT + dt / FLIP_DURATION_S);
    const e = easeInOut(this.animT);
    const targetPos = this.state === 'flipping_up' ? this.upPos : this.basePos;
    const targetQuat = this.state === 'flipping_up' ? this.upQuat : this.baseQuat;
    this.mesh.position.lerpVectors(this.startPos, targetPos, e);
    this.mesh.quaternion.slerpQuaternions(this.startQuat, targetQuat, e);
    if (this.animT >= 1) {
      this.state = this.state === 'flipping_up' ? 'up' : 'down';
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    // Materials are shared per player area and disposed there.
  }

  private beginTransition(next: 'flipping_up' | 'flipping_down'): void {
    this.state = next;
    this.animT = 0;
    this.startPos.copy(this.mesh.position);
    this.startQuat.copy(this.mesh.quaternion);
  }
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
