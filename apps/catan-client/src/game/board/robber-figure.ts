import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  MeshStandardMaterial,
  NormalBlending,
  Points,
  PointsMaterial,
  Vector3,
} from 'three';
import { axialToWorld } from './hex';
import { BuildAnimation } from './build-animation';
import { TILE_HEIGHT } from '../tiles/tile';
import { createRobberKnightMount, type RobberKnightMount } from './robber-knight-mount';

const ROBBER_BASE_LIFT = 0.14;
const FIGURE_SCALE = 1.28;
const JUMP_MIN_DURATION = 0.38;
const JUMP_MAX_DURATION = 0.58;
const JUMP_HEIGHT_BASE = 0.52;
const JUMP_HEIGHT_PER_UNIT = 0.28;
const DUST_COLOR = 0xbcae8e;
const DUST_PARTICLE_COUNT = 14;
const DUST_GRAVITY = 6.2;
const DUST_LIFETIME = 0.55;

function smoothStep(t: number): number {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * (3 - 2 * x);
}

class RobberLandingDust {
  private readonly dustHost: Group;
  private readonly dust: Points;
  private readonly dustMaterial: PointsMaterial;
  private readonly dustGeometry: BufferGeometry;
  private readonly dustVelocities: Float32Array;
  private elapsed = 0;
  private finished = false;

  public constructor(dustHost: Group, origin: Vector3) {
    this.dustHost = dustHost;
    const positions = new Float32Array(DUST_PARTICLE_COUNT * 3);
    this.dustVelocities = new Float32Array(DUST_PARTICLE_COUNT * 3);
    for (let i = 0; i < DUST_PARTICLE_COUNT; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radial = 0.55 + Math.random() * 1.35;
      positions[i * 3] = origin.x + Math.cos(angle) * 0.12;
      positions[i * 3 + 1] = origin.y + 0.04 + Math.random() * 0.08;
      positions[i * 3 + 2] = origin.z + Math.sin(angle) * 0.12;
      this.dustVelocities[i * 3] = Math.cos(angle) * radial;
      this.dustVelocities[i * 3 + 1] = 1.6 + Math.random() * 2.1;
      this.dustVelocities[i * 3 + 2] = Math.sin(angle) * radial;
    }
    this.dustGeometry = new BufferGeometry();
    this.dustGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    this.dustMaterial = new PointsMaterial({
      color: DUST_COLOR,
      size: 0.38,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      blending: NormalBlending,
    });
    this.dust = new Points(this.dustGeometry, this.dustMaterial);
    this.dust.renderOrder = 5;
    this.dustHost.add(this.dust);
  }

  public update(dt: number): void {
    if (this.finished) return;
    this.elapsed += dt;
    if (this.elapsed < DUST_LIFETIME) {
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
      this.dustMaterial.opacity = 0.82 * (1 - this.elapsed / DUST_LIFETIME);
    } else if (this.dust.parent) {
      this.dustHost.remove(this.dust);
    }
    if (this.elapsed >= DUST_LIFETIME) {
      this.finished = true;
    }
  }

  public isDone(): boolean {
    return this.finished;
  }

  public dispose(): void {
    if (this.dust.parent) {
      this.dustHost.remove(this.dust);
    }
    this.dustGeometry.dispose();
    this.dustMaterial.dispose();
  }
}

export class RobberFigure {
  public readonly group: Group = new Group();

  private readonly animRoot: Group = new Group();
  private readonly knightMount: RobberKnightMount;
  private readonly buildIntroAnimations: BuildAnimation[] = [];
  private readonly landingDust: RobberLandingDust[] = [];
  private readonly dustHost: Group;

  private lastQ: number | null = null;
  private lastR: number | null = null;
  private jumping = false;
  private jumpElapsed = 0;
  private jumpDuration = 0;
  private readonly jumpStart = new Vector3();
  private readonly jumpEnd = new Vector3();
  private jumpArcHeight = 0;

  public constructor(dustHost: Group) {
    this.dustHost = dustHost;
    this.group.renderOrder = 8;
    this.knightMount = createRobberKnightMount();
    this.knightMount.root.scale.setScalar(FIGURE_SCALE);
    this.animRoot.add(this.knightMount.root);
    this.group.add(this.animRoot);
    this.group.visible = false;
  }

  public resetForNewBoard(): void {
    for (let i = this.buildIntroAnimations.length - 1; i >= 0; i -= 1) {
      this.buildIntroAnimations[i].dispose();
      this.buildIntroAnimations.splice(i, 1);
    }
    for (let i = this.landingDust.length - 1; i >= 0; i -= 1) {
      this.landingDust[i].dispose();
      this.landingDust.splice(i, 1);
    }
    this.jumping = false;
    this.lastQ = null;
    this.lastR = null;
    this.group.visible = false;
    this.knightMount.root.scale.setScalar(FIGURE_SCALE);
  }

  public syncCoord(q: number, r: number, boardJustRebuilt: boolean): void {
    if (!Number.isFinite(q) || !Number.isFinite(r)) {
      return;
    }
    if (boardJustRebuilt) {
      this.resetForNewBoard();
    }
    if (this.lastQ === q && this.lastR === r) {
      return;
    }
    const world = axialToWorld({ q, r });
    const targetX = world.x;
    const targetZ = world.z;
    const targetY = TILE_HEIGHT + ROBBER_BASE_LIFT;

    if (this.lastQ === null) {
      this.group.position.set(targetX, targetY, targetZ);
      this.group.visible = true;
      this.spawnIntroAnimation(targetX, targetY, targetZ);
    } else {
      this.jumpStart.copy(this.group.position);
      this.jumpEnd.set(targetX, targetY, targetZ);
      const dx = this.jumpEnd.x - this.jumpStart.x;
      const dz = this.jumpEnd.z - this.jumpStart.z;
      const dist = Math.hypot(dx, dz);
      this.jumpArcHeight = JUMP_HEIGHT_BASE + dist * JUMP_HEIGHT_PER_UNIT;
      this.jumpDuration = Math.min(
        JUMP_MAX_DURATION,
        Math.max(JUMP_MIN_DURATION, 0.32 + dist * 0.07),
      );
      this.jumpElapsed = 0;
      this.jumping = true;
    }
    this.lastQ = q;
    this.lastR = r;
  }

  public update(dt: number): void {
    for (let i = this.buildIntroAnimations.length - 1; i >= 0; i -= 1) {
      const animation = this.buildIntroAnimations[i];
      animation.update(dt);
      if (animation.isDone()) {
        animation.dispose();
        this.buildIntroAnimations.splice(i, 1);
      }
    }
    for (let i = this.landingDust.length - 1; i >= 0; i -= 1) {
      const dust = this.landingDust[i];
      dust.update(dt);
      if (dust.isDone()) {
        dust.dispose();
        this.landingDust.splice(i, 1);
      }
    }
    if (!this.jumping) {
      return;
    }
    this.jumpElapsed += dt;
    const tRaw = this.jumpDuration > 0 ? this.jumpElapsed / this.jumpDuration : 1;
    const t = Math.min(tRaw, 1);
    const e = smoothStep(t);
    const arc = this.jumpArcHeight * 4 * e * (1 - e);
    this.group.position.set(
      this.jumpStart.x + (this.jumpEnd.x - this.jumpStart.x) * e,
      this.jumpStart.y + (this.jumpEnd.y - this.jumpStart.y) * e + arc,
      this.jumpStart.z + (this.jumpEnd.z - this.jumpStart.z) * e,
    );
    if (t >= 1) {
      this.jumping = false;
      this.group.position.copy(this.jumpEnd);
      this.landingDust.push(
        new RobberLandingDust(
          this.dustHost,
          new Vector3(this.jumpEnd.x, this.jumpEnd.y, this.jumpEnd.z),
        ),
      );
    }
  }

  public dispose(): void {
    for (let i = 0; i < this.buildIntroAnimations.length; i += 1) {
      this.buildIntroAnimations[i].dispose();
    }
    this.buildIntroAnimations.length = 0;
    for (let i = 0; i < this.landingDust.length; i += 1) {
      this.landingDust[i].dispose();
    }
    this.landingDust.length = 0;
    this.knightMount.dispose();
    this.group.clear();
  }

  private spawnIntroAnimation(originX: number, originY: number, originZ: number): void {
    this.buildIntroAnimations.push(
      new BuildAnimation({
        building: this.animRoot,
        dustHost: this.dustHost,
        origin: new Vector3(originX, originY, originZ),
      }),
    );
  }
}
