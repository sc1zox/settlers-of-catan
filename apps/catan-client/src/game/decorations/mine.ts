import { BoxGeometry, ConeGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { TILE_HEIGHT } from '../tiles/tile';

/**
 * Mountain mine: timber-framed entrance set into the mountain plus a small
 * minecart that rolls in and out on a short track.
 */
export class Mine {
  readonly group: Group = new Group();
  private readonly cart: Group = new Group();
  private readonly trackLength = 0.4;
  private readonly trackDir = { x: 1, z: 0.4 };

  constructor() {
    const beam = new MeshStandardMaterial({ color: 0x3a2418, flatShading: true });
    const dark = new MeshStandardMaterial({ color: 0x0a0a0a, flatShading: true });
    const cartBody = new MeshStandardMaterial({ color: 0x2a2a30, flatShading: true });
    const ore = new MeshStandardMaterial({ color: 0xc7a14a, flatShading: true });
    const rail = new MeshStandardMaterial({ color: 0x55402a, flatShading: true });

    // Framed entrance.
    const opening = new Mesh(new BoxGeometry(0.3, 0.28, 0.04), dark);
    opening.position.set(0, TILE_HEIGHT + 0.14, 0);
    this.group.add(opening);
    const lintel = new Mesh(new BoxGeometry(0.38, 0.05, 0.06), beam);
    lintel.position.set(0, TILE_HEIGHT + 0.3, 0);
    lintel.castShadow = true;
    this.group.add(lintel);
    const leftPost = new Mesh(new BoxGeometry(0.05, 0.3, 0.06), beam);
    leftPost.position.set(-0.165, TILE_HEIGHT + 0.15, 0);
    leftPost.castShadow = true;
    this.group.add(leftPost);
    const rightPost = leftPost.clone();
    rightPost.position.x = 0.165;
    this.group.add(rightPost);

    // Track sleepers along the (1, 0.4) direction.
    const len = Math.hypot(this.trackDir.x, this.trackDir.z);
    const dx = this.trackDir.x / len;
    const dz = this.trackDir.z / len;
    const railAngle = Math.atan2(this.trackDir.z, this.trackDir.x);
    for (let i = 0; i < 5; i++) {
      const t = (i + 0.5) / 5;
      const sleeper = new Mesh(new BoxGeometry(0.12, 0.02, 0.04), rail);
      sleeper.position.set(
        dx * t * this.trackLength,
        TILE_HEIGHT + 0.01,
        dz * t * this.trackLength,
      );
      sleeper.rotation.y = -railAngle;
      this.group.add(sleeper);
    }

    // Minecart (sits inside the cart Group so we can translate it along the track).
    const body = new Mesh(new BoxGeometry(0.14, 0.1, 0.1), cartBody);
    body.position.y = 0.07;
    body.castShadow = true;
    this.cart.add(body);
    const oreLoad = new Mesh(new ConeGeometry(0.06, 0.05, 5), ore);
    oreLoad.position.y = 0.14;
    oreLoad.castShadow = true;
    this.cart.add(oreLoad);
    this.cart.rotation.y = -railAngle;
    this.group.add(this.cart);
  }

  update(t: number): void {
    // Ease in/out along the track every ~2 seconds.
    const phase = (Math.sin(t * 1.6) + 1) / 2; // 0..1
    const len = Math.hypot(this.trackDir.x, this.trackDir.z);
    const travel = phase * this.trackLength;
    this.cart.position.x = (this.trackDir.x / len) * travel;
    this.cart.position.z = (this.trackDir.z / len) * travel;
    this.cart.position.y = TILE_HEIGHT;
  }
}
