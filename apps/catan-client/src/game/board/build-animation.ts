import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  NormalBlending,
  Object3D,
  Points,
  PointsMaterial,
  Vector3,
} from 'three';

const DUST_COLOR = 0xbcae8e;
const DUST_PARTICLE_COUNT = 18;
const DUST_GRAVITY = 6.2;
const DUST_LIFETIME = 0.62;
/** Children pop in this fast, each staggered by STAGE_STAGGER. */
const STAGE_DURATION = 0.26;
const STAGE_STAGGER = 0.16;
const BACK_C1 = 1.70158;
const BACK_C3 = BACK_C1 + 1;

/** easeOutBack — overshoots slightly so each part "snaps" into place. */
function easeOutBack(t: number): number {
  const p = t - 1;
  return 1 + BACK_C3 * p * p * p + BACK_C1 * p * p;
}

interface StagedChild {
  readonly target: Object3D;
  readonly baseScale: Vector3;
  readonly startAt: number;
}

export interface BuildAnimationOptions {
  /** The building group whose children are revealed stage by stage. */
  readonly building: Group;
  /** Group that hosts the transient dust cloud (e.g. the BoardBuildings group). */
  readonly dustHost: Group;
  /** World position the dust puff originates from (building base). */
  readonly origin: Vector3;
}

/**
 * Plays a quick "construction speed-run": the building's child meshes pop in
 * one after another (foundation first, roof last — sorted by local Y), with a
 * dust cloud kicked up at the base. Purely visual; the meshes themselves are
 * permanent and owned by the caller.
 */
export class BuildAnimation {
  readonly building: Group;
  private readonly stages: StagedChild[];
  private readonly buildDuration: number;
  private readonly dust: Points;
  private readonly dustMaterial: PointsMaterial;
  private readonly dustGeometry: BufferGeometry;
  private readonly dustVelocities: Float32Array;
  private readonly dustHost: Group;
  private elapsed = 0;
  private finished = false;

  constructor(options: BuildAnimationOptions) {
    this.building = options.building;
    const children = [...options.building.children];
    children.sort((a, b) => a.position.y - b.position.y);
    this.stages = children.map((target, index) => {
      const staged: StagedChild = {
        target,
        baseScale: target.scale.clone(),
        startAt: index * STAGE_STAGGER,
      };
      // Start collapsed so the first frame already shows the pop-in.
      target.scale.set(0, 0, 0);
      return staged;
    });
    const lastStart = this.stages.length > 0 ? this.stages[this.stages.length - 1].startAt : 0;
    this.buildDuration = lastStart + STAGE_DURATION;

    this.dustHost = options.dustHost;
    const positions = new Float32Array(DUST_PARTICLE_COUNT * 3);
    this.dustVelocities = new Float32Array(DUST_PARTICLE_COUNT * 3);
    for (let i = 0; i < DUST_PARTICLE_COUNT; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radial = 0.6 + Math.random() * 1.6;
      positions[i * 3] = options.origin.x + Math.cos(angle) * 0.15;
      positions[i * 3 + 1] = options.origin.y + 0.04 + Math.random() * 0.1;
      positions[i * 3 + 2] = options.origin.z + Math.sin(angle) * 0.15;
      this.dustVelocities[i * 3] = Math.cos(angle) * radial;
      this.dustVelocities[i * 3 + 1] = 1.8 + Math.random() * 2.4;
      this.dustVelocities[i * 3 + 2] = Math.sin(angle) * radial;
    }
    this.dustGeometry = new BufferGeometry();
    this.dustGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    this.dustMaterial = new PointsMaterial({
      color: DUST_COLOR,
      size: 0.42,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: NormalBlending,
    });
    this.dust = new Points(this.dustGeometry, this.dustMaterial);
    this.dust.renderOrder = 5;
    this.dustHost.add(this.dust);
  }

  update(dt: number): void {
    if (this.finished) return;
    this.elapsed += dt;

    for (let i = 0; i < this.stages.length; i += 1) {
      const stage = this.stages[i];
      const local = this.elapsed - stage.startAt;
      if (local <= 0) {
        continue;
      }
      const t = Math.min(local / STAGE_DURATION, 1);
      const eased = t >= 1 ? 1 : easeOutBack(t);
      stage.target.scale.set(
        stage.baseScale.x * eased,
        stage.baseScale.y * eased,
        stage.baseScale.z * eased,
      );
    }

    const dustAge = this.elapsed;
    if (dustAge < DUST_LIFETIME) {
      const positions = this.dustGeometry.getAttribute('position') as Float32BufferAttribute;
      for (let i = 0; i < DUST_PARTICLE_COUNT; i += 1) {
        this.dustVelocities[i * 3 + 1] -= DUST_GRAVITY * dt;
        positions.setXYZ(
          i,
          positions.getX(i) + this.dustVelocities[i * 3] * dt,
          Math.max(positions.getY(i) + this.dustVelocities[i * 3 + 1] * dt, 0),
          positions.getZ(i) + this.dustVelocities[i * 3 + 2] * dt,
        );
      }
      positions.needsUpdate = true;
      this.dustMaterial.opacity = 0.85 * (1 - dustAge / DUST_LIFETIME);
    } else if (this.dust.parent) {
      this.dustHost.remove(this.dust);
    }

    if (this.elapsed >= Math.max(this.buildDuration, DUST_LIFETIME)) {
      // Guarantee exact rest scale regardless of frame timing.
      for (let i = 0; i < this.stages.length; i += 1) {
        const stage = this.stages[i];
        stage.target.scale.copy(stage.baseScale);
      }
      this.finished = true;
    }
  }

  isDone(): boolean {
    return this.finished;
  }

  dispose(): void {
    if (this.dust.parent) {
      this.dustHost.remove(this.dust);
    }
    this.dustGeometry.dispose();
    this.dustMaterial.dispose();
  }
}
