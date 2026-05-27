import {
  ConeGeometry,
  CylinderGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import { applySway, SwayInstance } from '../animation/wind';
import { createRng, scatterInHex } from '../animation/rng';
import { HEX_SIZE } from '../board/hex';
import { Lumberjack } from '../decorations/lumberjack';
import { runtimeFlags } from '../engine-runtime/runtime-flags';
import { Tile, TileInit, TILE_HEIGHT } from './tile';

const TREE_COUNT = 14;
const TRUNK_HEIGHT = 0.18;
const FOLIAGE_HEIGHT = 0.7;

export class ForestTile extends Tile {
  private readonly foliage: InstancedMesh;
  private readonly trunks: InstancedMesh;
  private readonly instances: SwayInstance[] = [];
  private readonly lumberjack: Lumberjack;

  constructor(init: TileInit) {
    super(init);

    const rng = createRng((this.coord.q * 73856093) ^ (this.coord.r * 19349663));

    const trunkGeom = new CylinderGeometry(0.04, 0.06, TRUNK_HEIGHT, 5);
    trunkGeom.translate(0, TRUNK_HEIGHT / 2, 0);
    const trunkMat = new MeshStandardMaterial({ color: 0x5a3a22, flatShading: true });
    this.trunks = new InstancedMesh(trunkGeom, trunkMat, TREE_COUNT);
    this.trunks.castShadow = true;
    this.trunks.receiveShadow = true;

    const foliageGeom = new ConeGeometry(0.22, FOLIAGE_HEIGHT, 6);
    foliageGeom.translate(0, TRUNK_HEIGHT + FOLIAGE_HEIGHT / 2, 0);
    const foliageMat = new MeshStandardMaterial({ color: 0x3a7d3a, flatShading: true });
    this.foliage = new InstancedMesh(foliageGeom, foliageMat, TREE_COUNT);
    this.foliage.castShadow = true;
    this.foliage.receiveShadow = false;

    const points = scatterInHex(HEX_SIZE * 0.75, TREE_COUNT, rng);
    for (const p of points) {
      this.instances.push({
        basePosition: new Vector3(p.x, TILE_HEIGHT, p.z),
        baseScale: new Vector3(1, 0.85 + rng() * 0.5, 1),
        baseYaw: rng() * Math.PI * 2,
        phase: rng() * Math.PI * 2,
        intensity: 0.5 + rng() * 0.5,
      });
    }
    this.group.add(this.foliage, this.trunks);

    // Lumberjack sits at a clearing near the tile centre, hidden until settled.
    this.lumberjack = new Lumberjack();
    this.lumberjack.group.position.set(HEX_SIZE * 0.35, 0, -HEX_SIZE * 0.35);
    this.lumberjack.group.rotation.y = Math.PI * 0.35;
    this.lumberjack.group.visible = false;
    this.group.add(this.lumberjack.group);
  }

  override update(dt: number, t: number): void {
    super.update(dt, t);
    if (!runtimeFlags.ambientAnimationsEnabled) {
      this.lumberjack.group.visible = false;
      return;
    }
    const amplitude = this.settled ? 0.16 : 0.08;
    applySway(this.foliage, this.instances, t, { amplitude, frequency: 0.4 });
    applySway(this.trunks, this.instances, t, { amplitude: amplitude * 0.4, frequency: 0.4 });
    this.lumberjack.group.visible = this.settled;
    if (this.settled) this.lumberjack.update(t);
  }

  override dispose(): void {
    super.dispose();
    this.foliage.dispose();
    this.trunks.dispose();
  }
}
