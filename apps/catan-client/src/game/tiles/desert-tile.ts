import { CylinderGeometry, Mesh, MeshStandardMaterial } from 'three';
import { createRng, scatterInHex } from '../animation/rng';
import { HEX_SIZE } from '../board/hex';
import { Tile, TileInit, TILE_HEIGHT } from './tile';

export class DesertTile extends Tile {
  constructor(init: TileInit) {
    super(init);
    const rng = createRng((this.coord.q * 3010349) ^ (this.coord.r * 999983));

    // Two stylised cacti.
    const cactusMat = new MeshStandardMaterial({ color: 0x4a7a3e, flatShading: true });
    for (const p of scatterInHex(HEX_SIZE * 0.6, 2, rng)) {
      const trunkH = 0.45;
      const trunk = new Mesh(new CylinderGeometry(0.07, 0.08, trunkH, 6), cactusMat);
      trunk.castShadow = true;
      trunk.position.set(p.x, TILE_HEIGHT + trunkH / 2, p.z);
      this.group.add(trunk);
      const arm = new Mesh(new CylinderGeometry(0.05, 0.05, 0.2, 6), cactusMat);
      arm.castShadow = true;
      arm.position.set(p.x + 0.09, TILE_HEIGHT + trunkH * 0.7, p.z);
      arm.rotation.z = Math.PI / 2.4;
      this.group.add(arm);
    }
  }
}
