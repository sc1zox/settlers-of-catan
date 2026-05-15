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
 * Track runs straight out of the cave in the mine's local +Z direction so
 * the cart enters and exits along the entrance's normal — no sideways travel.
 */
const TRACK_LENGTH = 0.55;
const SLEEPER_TOP_Y = 0.025;
const RAIL_TOP_Y = 0.05;
const WHEEL_RADIUS = 0.03;

/**
 * Mountain mine: a stone-framed cave entrance set into the mountain (the
 * mountain mass itself is rendered by `MountainsTile` so it stays visible
 * even on unsettled tiles), twin iron rails on wooden sleepers, and a
 * four-wheeled minecart that shuttles its ore load along the track. The
 * cart and rails are oriented so the cart drives straight in and out of
 * the cave entrance rather than sideways.
 */
export class Mine {
  readonly group: Group = new Group();
  private readonly cart: Group = new Group();

  constructor() {
    const beam = new MeshStandardMaterial({ color: 0x3a2418, flatShading: true });
    const dark = new MeshStandardMaterial({ color: 0x070707, flatShading: true });
    const stone = new MeshStandardMaterial({
      color: 0x55585c,
      flatShading: true,
      roughness: 0.92,
    });
    const cartBody = new MeshStandardMaterial({
      color: 0x35261b,
      flatShading: true,
      roughness: 0.7,
    });
    const cartMetal = new MeshStandardMaterial({
      color: 0x3e3f48,
      flatShading: true,
      roughness: 0.55,
      metalness: 0.65,
    });
    const ore = new MeshStandardMaterial({
      color: 0xd1a64a,
      emissive: 0x4a3110,
      emissiveIntensity: 0.4,
      flatShading: true,
      metalness: 0.4,
      roughness: 0.5,
    });
    const rail = new MeshStandardMaterial({
      color: 0x32333a,
      flatShading: true,
      metalness: 0.7,
      roughness: 0.4,
    });
    const sleeperMat = new MeshStandardMaterial({ color: 0x55402a, flatShading: true });

    // === Mountainside masonry framing the entrance — three layered stones
    // pushed back into the mountain so the opening reads as carved IN ===
    for (let i = 0; i < 3; i++) {
      const w = 0.22 + i * 0.06;
      const h = 0.36 + i * 0.06;
      const block = new Mesh(new BoxGeometry(w, h, 0.08), stone);
      block.position.set(0, TILE_HEIGHT + h / 2, -0.04 - i * 0.03);
      block.castShadow = true;
      block.receiveShadow = true;
      this.group.add(block);
    }

    // Deep dark opening — pushed back into the masonry so it reads as a void.
    const opening = new Mesh(new BoxGeometry(0.24, 0.28, 0.1), dark);
    opening.position.set(0, TILE_HEIGHT + 0.14, 0.015);
    this.group.add(opening);

    // === Timber frame: two posts, a lintel, and a diagonal brace ===
    const lintel = new Mesh(new BoxGeometry(0.38, 0.06, 0.09), beam);
    lintel.position.set(0, TILE_HEIGHT + 0.31, 0.03);
    lintel.castShadow = true;
    this.group.add(lintel);
    for (const xPos of [-0.16, 0.16]) {
      const post = new Mesh(new BoxGeometry(0.05, 0.32, 0.09), beam);
      post.position.set(xPos, TILE_HEIGHT + 0.16, 0.03);
      post.castShadow = true;
      this.group.add(post);
    }
    const brace = new Mesh(new BoxGeometry(0.04, 0.2, 0.05), beam);
    brace.position.set(-0.135, TILE_HEIGHT + 0.27, 0.07);
    brace.rotation.z = 0.6;
    brace.castShadow = true;
    this.group.add(brace);

    // === Track runs along +Z (straight out of the cave) ===
    const gauge = 0.055;

    // Wooden sleepers — perpendicular to the track direction. Long axis (local
    // X) stays aligned with world X, so no Y rotation needed.
    for (let i = 0; i < 6; i++) {
      const zPos = ((i + 0.5) / 6) * TRACK_LENGTH;
      const sleeper = new Mesh(new BoxGeometry(0.18, 0.025, 0.05), sleeperMat);
      sleeper.position.set(0, TILE_HEIGHT + SLEEPER_TOP_Y - 0.0125, zPos);
      sleeper.castShadow = true;
      sleeper.receiveShadow = true;
      this.group.add(sleeper);
    }

    // Two parallel iron rails — rotated so the long axis runs along +Z.
    const railGeom = new BoxGeometry(TRACK_LENGTH, 0.02, 0.025);
    for (const side of [-1, 1]) {
      const railMesh = new Mesh(railGeom, rail);
      railMesh.position.set(side * gauge, TILE_HEIGHT + RAIL_TOP_Y - 0.01, TRACK_LENGTH * 0.5);
      railMesh.rotation.y = -Math.PI / 2;
      railMesh.castShadow = true;
      this.group.add(railMesh);
    }

    // === Minecart: body, metal rim, ore pile, 4 wheels ===
    const wheelCenterY = RAIL_TOP_Y + WHEEL_RADIUS;
    const bodyBottomY = wheelCenterY + WHEEL_RADIUS + 0.005;
    const bodyHeight = 0.09;
    const bodyCenterY = bodyBottomY + bodyHeight / 2;
    // Cart's local +X is its direction of travel; after `cart.rotation.y =
    // -π/2` it maps to world +Z (along the rails).
    const body = new Mesh(new BoxGeometry(0.16, bodyHeight, 0.13), cartBody);
    body.position.y = bodyCenterY;
    body.castShadow = true;
    this.cart.add(body);

    const rim = new Mesh(new BoxGeometry(0.18, 0.022, 0.15), cartMetal);
    rim.position.y = bodyCenterY + bodyHeight / 2 + 0.005;
    rim.castShadow = true;
    this.cart.add(rim);

    const oreLoad = new Mesh(new ConeGeometry(0.07, 0.06, 5), ore);
    oreLoad.position.y = bodyCenterY + bodyHeight / 2 + 0.05;
    oreLoad.castShadow = true;
    this.cart.add(oreLoad);

    // Wheels — axle along local Z (perpendicular to motion). Rotating about
    // local X tilts the default Y-axis cylinder to Z.
    const wheelGeom = new CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.022, 10);
    for (const sx of [-0.055, 0.055]) {
      for (const sz of [-0.075, 0.075]) {
        const wheel = new Mesh(wheelGeom, cartMetal);
        wheel.position.set(sx, wheelCenterY, sz);
        wheel.rotation.x = Math.PI / 2;
        wheel.castShadow = true;
        this.cart.add(wheel);
      }
    }

    // Cart starts at the cave mouth (local origin) and travels out along +Z.
    this.cart.rotation.y = -Math.PI / 2;
    this.group.add(this.cart);
  }

  update(t: number): void {
    // Ease in/out along the track every ~2 seconds.
    const phase = (Math.sin(t * 1.6) + 1) / 2;
    this.cart.position.x = 0;
    this.cart.position.z = phase * TRACK_LENGTH;
    this.cart.position.y = TILE_HEIGHT;
  }
}
