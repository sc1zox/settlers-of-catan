import { BoxGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import { createRng, scatterInHex } from '../animation/rng';
import { HEX_SIZE } from '../board/hex';
import { Tile, TileInit, TILE_HEIGHT } from './tile';

const SHEEP_COUNT = 5;

interface SheepInstance {
  readonly group: Group;
  readonly wanderCenter: Vector3;
  readonly wanderRadius: number;
  readonly phase: number;
  readonly speed: number;
}

export class PastureTile extends Tile {
  private readonly sheep: SheepInstance[] = [];

  constructor(init: TileInit) {
    super(init);
    const rng = createRng((this.coord.q * 67867967) ^ (this.coord.r * 32452867));

    const bodyMat = new MeshStandardMaterial({ color: 0xf3eee2, flatShading: true });
    const headMat = new MeshStandardMaterial({ color: 0x2a2018, flatShading: true });
    const bodyGeom = new SphereGeometry(0.13, 8, 6);
    const headGeom = new BoxGeometry(0.07, 0.07, 0.08);

    const points = scatterInHex(HEX_SIZE * 0.65, SHEEP_COUNT, rng);
    for (const p of points) {
      const sheepGroup = new Group();
      const body = new Mesh(bodyGeom, bodyMat);
      body.castShadow = true;
      body.position.y = TILE_HEIGHT + 0.13;
      const head = new Mesh(headGeom, headMat);
      head.castShadow = true;
      head.position.set(0.12, TILE_HEIGHT + 0.16, 0);
      sheepGroup.add(body, head);
      sheepGroup.position.set(p.x, 0, p.z);
      sheepGroup.rotation.y = rng() * Math.PI * 2;
      this.group.add(sheepGroup);
      this.sheep.push({
        group: sheepGroup,
        wanderCenter: new Vector3(p.x, 0, p.z),
        wanderRadius: 0.1 + rng() * 0.15,
        phase: rng() * Math.PI * 2,
        speed: 0.25 + rng() * 0.25,
      });
    }
  }

  override update(dt: number, t: number): void {
    super.update(dt, t);
    // Sheep amble slowly in tiny circles; more lively when settled.
    const speedScale = this.settled ? 1.6 : 1.0;
    for (const s of this.sheep) {
      const angle = t * s.speed * speedScale + s.phase;
      const x = s.wanderCenter.x + Math.cos(angle) * s.wanderRadius;
      const z = s.wanderCenter.z + Math.sin(angle) * s.wanderRadius;
      s.group.position.set(x, 0, z);
      s.group.rotation.y = -angle + Math.PI / 2;
    }
  }
}
