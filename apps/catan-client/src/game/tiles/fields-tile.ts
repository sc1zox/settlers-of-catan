import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { applySway, SwayInstance } from '../animation/wind';
import { createRng } from '../animation/rng';
import { HEX_SIZE } from '../board/hex';
import { Windmill } from '../decorations/windmill';
import { runtimeFlags } from '../engine-runtime/runtime-flags';
import { Tile, TileInit, TILE_HEIGHT } from './tile';

const STALK_HEIGHT = 0.55;
const ROWS = 6;
const PER_ROW = 9;
/** Plant rows tilt slightly off-axis so they don't read as a grid. */
const ROW_ANGLE = 0.35;
const ROW_SPACING = 0.3;
const COL_SPACING = 0.22;

/**
 * Field hex: wheat stalks in tilted rows (two colour shades for a "ripening"
 * look), two hay-sheaves at the field's edge, a scarecrow watching over it
 * and the corner windmill. The windmill spins lazily until the tile is
 * settled, then accelerates.
 */
export class FieldsTile extends Tile {
  private readonly stalksGold: InstancedMesh;
  private readonly stalksPale: InstancedMesh;
  private readonly goldInstances: SwayInstance[] = [];
  private readonly paleInstances: SwayInstance[] = [];
  private readonly windmill: Windmill;

  constructor(init: TileInit) {
    super(init);
    const rng = createRng((this.coord.q * 49979693) ^ (this.coord.r * 86028157));

    // Golden ripe wheat — the bulk of the field.
    const goldGeom = new ConeGeometry(0.08, STALK_HEIGHT, 4);
    goldGeom.translate(0, STALK_HEIGHT / 2, 0);
    const goldMat = new MeshStandardMaterial({ color: 0xe7c75a, flatShading: true });
    // Pale young stalks mixed in for variety.
    const paleGeom = new ConeGeometry(0.07, STALK_HEIGHT * 0.85, 4);
    paleGeom.translate(0, (STALK_HEIGHT * 0.85) / 2, 0);
    const paleMat = new MeshStandardMaterial({ color: 0xb8c656, flatShading: true });

    const windmillX = -HEX_SIZE * 0.45;
    const windmillZ = HEX_SIZE * 0.4;
    const scarecrowX = HEX_SIZE * 0.32;
    const scarecrowZ = -HEX_SIZE * 0.18;

    const cosA = Math.cos(ROW_ANGLE);
    const sinA = Math.sin(ROW_ANGLE);
    // Row direction (along which a single row extends).
    const rowDirX = cosA;
    const rowDirZ = sinA;
    // Cross-row direction (perpendicular).
    const colDirX = -sinA;
    const colDirZ = cosA;

    // First pass: lay out the grid; classify each point gold/pale, skipping
    // anything that would clip the windmill / scarecrow / outside the slab.
    const candidates: { pos: Vector3; pale: boolean }[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < PER_ROW; c++) {
        const rOff = (r - (ROWS - 1) / 2) * ROW_SPACING + (rng() - 0.5) * 0.06;
        const cOff = (c - (PER_ROW - 1) / 2) * COL_SPACING + (rng() - 0.5) * 0.08;
        const x = rowDirX * cOff + colDirX * rOff;
        const z = rowDirZ * cOff + colDirZ * rOff;
        if (Math.hypot(x - windmillX, z - windmillZ) < 0.55) continue;
        if (Math.hypot(x - scarecrowX, z - scarecrowZ) < 0.35) continue;
        if (Math.hypot(x, z) > HEX_SIZE * 0.8) continue;
        const pale = rng() < 0.22;
        candidates.push({ pos: new Vector3(x, TILE_HEIGHT, z), pale });
      }
    }

    const goldCount = candidates.filter((p) => !p.pale).length;
    const paleCount = candidates.length - goldCount;
    this.stalksGold = new InstancedMesh(goldGeom, goldMat, Math.max(1, goldCount));
    this.stalksPale = new InstancedMesh(paleGeom, paleMat, Math.max(1, paleCount));
    this.stalksGold.castShadow = true;
    this.stalksGold.receiveShadow = true;
    this.stalksPale.castShadow = true;
    this.stalksPale.receiveShadow = true;
    // Resize down to actual counts so unused slots don't draw a default identity.
    this.stalksGold.count = goldCount;
    this.stalksPale.count = paleCount;

    for (const candidate of candidates) {
      const instance: SwayInstance = {
        basePosition: candidate.pos,
        baseScale: new Vector3(1, 0.7 + rng() * 0.6, 1),
        baseYaw: rng() * Math.PI * 2,
        phase: rng() * Math.PI * 2,
        intensity: 0.55 + rng() * 0.45,
      };
      if (candidate.pale) this.paleInstances.push(instance);
      else this.goldInstances.push(instance);
    }

    this.group.add(this.stalksGold);
    this.group.add(this.stalksPale);

    // === Hay sheaves — two compact bundles tied with a darker band ===
    const sheafBody = new MeshStandardMaterial({ color: 0xc8a04a, flatShading: true });
    const sheafBand = new MeshStandardMaterial({ color: 0x6b4a26, flatShading: true });
    for (const seat of [
      { x: HEX_SIZE * 0.6, z: -HEX_SIZE * 0.55, rot: 0.5 },
      { x: HEX_SIZE * 0.25, z: -HEX_SIZE * 0.7, rot: -0.4 },
    ]) {
      const sheaf = new Group();
      const body = new Mesh(new CylinderGeometry(0.12, 0.18, 0.34, 7), sheafBody);
      body.position.y = TILE_HEIGHT + 0.17;
      body.castShadow = true;
      body.receiveShadow = true;
      sheaf.add(body);
      const band = new Mesh(new CylinderGeometry(0.155, 0.155, 0.04, 7), sheafBand);
      band.position.y = TILE_HEIGHT + 0.22;
      sheaf.add(band);
      // A few "ear" tips poking out at the top for texture.
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const ear = new Mesh(new ConeGeometry(0.04, 0.1, 3), sheafBody);
        ear.position.set(Math.cos(a) * 0.07, TILE_HEIGHT + 0.4, Math.sin(a) * 0.07);
        ear.rotation.set((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3);
        sheaf.add(ear);
      }
      sheaf.position.set(seat.x, 0, seat.z);
      sheaf.rotation.y = seat.rot;
      this.group.add(sheaf);
    }

    // === Scarecrow — wooden cross, cloth shirt, straw head, conical hat ===
    const scareWood = new MeshStandardMaterial({ color: 0x6b4a26, flatShading: true });
    const scareCloth = new MeshStandardMaterial({ color: 0x9c4536, flatShading: true });
    const scareStraw = new MeshStandardMaterial({ color: 0xe7c75a, flatShading: true });
    const scareHat = new MeshStandardMaterial({ color: 0x3a2418, flatShading: true });
    const post = new Mesh(new BoxGeometry(0.05, 0.68, 0.05), scareWood);
    post.position.set(scarecrowX, TILE_HEIGHT + 0.34, scarecrowZ);
    post.castShadow = true;
    this.group.add(post);
    const arm = new Mesh(new BoxGeometry(0.36, 0.045, 0.045), scareWood);
    arm.position.set(scarecrowX, TILE_HEIGHT + 0.5, scarecrowZ);
    arm.castShadow = true;
    this.group.add(arm);
    const shirt = new Mesh(new BoxGeometry(0.2, 0.2, 0.07), scareCloth);
    shirt.position.set(scarecrowX, TILE_HEIGHT + 0.42, scarecrowZ);
    shirt.castShadow = true;
    this.group.add(shirt);
    const head = new Mesh(new SphereGeometry(0.08, 8, 6), scareStraw);
    head.position.set(scarecrowX, TILE_HEIGHT + 0.6, scarecrowZ);
    head.castShadow = true;
    this.group.add(head);
    const hat = new Mesh(new ConeGeometry(0.1, 0.09, 8), scareHat);
    hat.position.set(scarecrowX, TILE_HEIGHT + 0.69, scarecrowZ);
    hat.castShadow = true;
    this.group.add(hat);
    // Straw poking out of the sleeves so the scarecrow doesn't look like a sign.
    for (const sign of [-1, 1]) {
      const straw = new Mesh(new ConeGeometry(0.03, 0.08, 4), scareStraw);
      straw.position.set(scarecrowX + sign * 0.18, TILE_HEIGHT + 0.5, scarecrowZ);
      straw.rotation.z = sign * 0.5;
      this.group.add(straw);
    }

    // === Windmill — sits at the far corner and spins.
    this.windmill = new Windmill();
    this.windmill.group.position.set(windmillX, 0, windmillZ);
    this.windmill.group.rotation.y = Math.PI * 0.25;
    this.group.add(this.windmill.group);
  }

  override update(dt: number, t: number): void {
    super.update(dt, t);
    if (!runtimeFlags.ambientAnimationsEnabled) {
      return;
    }
    const amplitude = this.settled ? 0.28 : 0.14;
    applySway(this.stalksGold, this.goldInstances, t, { amplitude, frequency: 0.7 });
    applySway(this.stalksPale, this.paleInstances, t, {
      amplitude: amplitude * 0.85,
      frequency: 0.75,
    });
    this.windmill.update(dt, this.settled ? 1.4 : 0.35);
  }

  override dispose(): void {
    super.dispose();
    this.stalksGold.dispose();
    this.stalksPale.dispose();
  }
}
