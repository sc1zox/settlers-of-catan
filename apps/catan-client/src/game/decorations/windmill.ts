import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { TILE_HEIGHT } from '../tiles/tile';

/**
 * Stylised low-poly windmill: round tower, conical cap, four rotating blades.
 */
export class Windmill {
  readonly group: Group = new Group();
  private readonly blades: Group = new Group();

  constructor() {
    const wall = new MeshStandardMaterial({ color: 0xe6d9ad, flatShading: true });
    const roof = new MeshStandardMaterial({ color: 0x7a3a25, flatShading: true });
    const beam = new MeshStandardMaterial({ color: 0x3a2418, flatShading: true });
    const sail = new MeshStandardMaterial({ color: 0xf4ecd8, flatShading: true });

    const towerH = 0.55;
    const tower = new Mesh(new CylinderGeometry(0.16, 0.22, towerH, 8), wall);
    tower.position.y = TILE_HEIGHT + towerH / 2;
    tower.castShadow = true;
    tower.receiveShadow = true;
    this.group.add(tower);

    const capH = 0.18;
    const cap = new Mesh(new ConeGeometry(0.18, capH, 8), roof);
    cap.position.y = TILE_HEIGHT + towerH + capH / 2;
    cap.castShadow = true;
    this.group.add(cap);

    // Blade hub sits on the front face of the cap so it tilts slightly forward.
    this.blades.position.set(0, TILE_HEIGHT + towerH + 0.05, 0.18);
    this.blades.rotation.x = -0.05;
    this.group.add(this.blades);

    const hub = new Mesh(new CylinderGeometry(0.03, 0.03, 0.06, 6), beam);
    hub.rotation.x = Math.PI / 2;
    this.blades.add(hub);

    // Four sails: a thin beam + a paper-like rectangle.
    for (let i = 0; i < 4; i++) {
      const sailGroup = new Group();
      sailGroup.rotation.z = (i * Math.PI) / 2;
      const beamMesh = new Mesh(new BoxGeometry(0.04, 0.36, 0.02), beam);
      beamMesh.position.y = 0.18;
      beamMesh.castShadow = true;
      sailGroup.add(beamMesh);
      const sailMesh = new Mesh(new BoxGeometry(0.18, 0.32, 0.005), sail);
      sailMesh.position.set(0.12, 0.2, 0.015);
      sailMesh.castShadow = true;
      sailGroup.add(sailMesh);
      this.blades.add(sailGroup);
    }
  }

  /** Spins the blade group at `radiansPerSecond`. */
  update(dt: number, radiansPerSecond: number): void {
    this.blades.rotation.z += dt * radiansPerSecond;
  }
}
