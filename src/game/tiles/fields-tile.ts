import { ConeGeometry, InstancedMesh, MeshStandardMaterial, Vector3 } from 'three';
import { applySway, SwayInstance } from '../animation/wind';
import { createRng, scatterInHex } from '../animation/rng';
import { HEX_SIZE } from '../board/hex';
import { Windmill } from '../decorations/windmill';
import { Tile, TileInit, TILE_HEIGHT } from './tile';

const STALK_COUNT = 48;
const STALK_HEIGHT = 0.5;

export class FieldsTile extends Tile {
  private readonly stalks: InstancedMesh;
  private readonly instances: SwayInstance[] = [];
  private readonly windmill: Windmill;

  constructor(init: TileInit) {
    super(init);
    const rng = createRng((this.coord.q * 49979693) ^ (this.coord.r * 86028157));

    const geom = new ConeGeometry(0.08, STALK_HEIGHT, 4);
    geom.translate(0, STALK_HEIGHT / 2, 0);
    const mat = new MeshStandardMaterial({ color: 0xe7c75a, flatShading: true });
    this.stalks = new InstancedMesh(geom, mat, STALK_COUNT);
    this.stalks.castShadow = true;
    this.stalks.receiveShadow = true;

    const pts = scatterInHex(HEX_SIZE * 0.78, STALK_COUNT, rng);
    for (const p of pts) {
      this.instances.push({
        basePosition: new Vector3(p.x, TILE_HEIGHT, p.z),
        baseScale: new Vector3(1, 0.7 + rng() * 0.6, 1),
        baseYaw: rng() * Math.PI * 2,
        phase: rng() * Math.PI * 2,
        intensity: 0.6 + rng() * 0.4,
      });
    }
    this.group.add(this.stalks);

    // Windmill sits at the edge of the field; rotates faster when settled.
    this.windmill = new Windmill();
    this.windmill.group.position.set(-HEX_SIZE * 0.45, 0, HEX_SIZE * 0.4);
    this.windmill.group.rotation.y = Math.PI * 0.25;
    this.group.add(this.windmill.group);
  }

  override update(dt: number, t: number): void {
    super.update(dt, t);
    const amplitude = this.settled ? 0.28 : 0.14;
    applySway(this.stalks, this.instances, t, { amplitude, frequency: 0.7 });
    // Always turning lazily; spin up to real working speed when the field is settled.
    this.windmill.update(dt, this.settled ? 1.4 : 0.35);
  }

  override dispose(): void {
    super.dispose();
    this.stalks.dispose();
  }
}
