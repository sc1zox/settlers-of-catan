import { Group, IcosahedronGeometry, Mesh, MeshStandardMaterial } from 'three';

/**
 * Moderate "sky" altitude band. The camera can't pitch above horizontal
 * (OrbitControls maxPolarAngle ≈ π/2) and the FOV is 45°, so anything more than
 * ~20° above the camera is never in frame — clouds parked high overhead would
 * simply be invisible. This band keeps them within the camera's actual pitch
 * range while still reading clearly as sky.
 */
const RING_CLOUD_COUNT = 22;
const RING_MIN_HEIGHT = 16;
const RING_MAX_HEIGHT = 34;
const RING_MIN_RADIUS = 30;
const RING_MAX_RADIUS = 66;

/**
 * Localized overcast deck hanging over roughly one half of the board
 * (x ≈ -1…17). Denser and much flatter than the ring clouds so the puffs merge
 * into a connected blanket.
 */
const DECK_HEIGHT = 24;
const DECK_COLUMNS = 4;
const DECK_ROWS = 5;
const DECK_X_MIN = -1;
const DECK_X_MAX = 17;
const DECK_Z_MIN = -16;
const DECK_Z_MAX = 16;

/** Whole field drifts slowly around the board (radians per second). */
const DRIFT_SPEED = 0.012;

interface Cloud {
  readonly group: Group;
  readonly baseY: number;
  readonly bobAmplitude: number;
  readonly bobSpeed: number;
  readonly phase: number;
}

/** Per-cloud silhouette: how many puffs, how wide, and how flat. */
interface CloudShape {
  readonly puffs: number;
  readonly spread: number;
  /** Vertical scale factor for each puff — lower = flatter, more deck-like. */
  readonly flatten: number;
  /** Max vertical bob amplitude. */
  readonly bob: number;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Low-poly "polygon" clouds at a moderate altitude. Two layers: drifting puffy
 * clouds ringing the scene, and a denser, flatter overcast deck over about half
 * the board. Each cloud is a cluster of faceted icosahedron puffs (flat-shaded)
 * so it reads as a bushy mass rather than a single ball. Purely decorative —
 * fogged, no shadow.
 */
export class CloudField {
  readonly group: Group = new Group();

  private readonly geometry: IcosahedronGeometry;
  private readonly material: MeshStandardMaterial;
  private readonly clouds: Cloud[] = [];

  constructor() {
    // detail 0 → 20 flat triangles: deliberately faceted, "polygon" look.
    this.geometry = new IcosahedronGeometry(1, 0);
    this.material = new MeshStandardMaterial({
      color: 0xfbfbf6,
      flatShading: true,
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: 0.96,
      fog: true,
    });

    let index = 0;

    // Drifting ring around the board.
    for (let i = 0; i < RING_CLOUD_COUNT; i += 1) {
      const angle = (i / RING_CLOUD_COUNT) * Math.PI * 2 + rand(-0.25, 0.25);
      const radius = rand(RING_MIN_RADIUS, RING_MAX_RADIUS);
      this.clouds.push(
        this.makeCloud(
          index,
          Math.cos(angle) * radius,
          rand(RING_MIN_HEIGHT, RING_MAX_HEIGHT),
          Math.sin(angle) * radius,
          { puffs: Math.round(rand(5, 9)), spread: rand(2.4, 4.0), flatten: rand(0.6, 0.85), bob: 0.9 },
        ),
      );
      index += 1;
    }

    // Localized overcast deck over ~half the map — a jittered grid of wide,
    // flat clusters whose puffs overlap into a continuous blanket.
    for (let cx = 0; cx < DECK_COLUMNS; cx += 1) {
      for (let cz = 0; cz < DECK_ROWS; cz += 1) {
        const x = DECK_X_MIN + ((cx + 0.5) / DECK_COLUMNS) * (DECK_X_MAX - DECK_X_MIN) + rand(-2, 2);
        const z = DECK_Z_MIN + ((cz + 0.5) / DECK_ROWS) * (DECK_Z_MAX - DECK_Z_MIN) + rand(-2, 2);
        this.clouds.push(
          this.makeCloud(index, x, DECK_HEIGHT + rand(-1.2, 1.2), z, {
            puffs: Math.round(rand(9, 14)),
            spread: rand(4.5, 6.5),
            flatten: rand(0.3, 0.46),
            bob: 0.35,
          }),
        );
        index += 1;
      }
    }
  }

  private makeCloud(index: number, x: number, y: number, z: number, shape: CloudShape): Cloud {
    const cloud = new Group();
    cloud.position.set(x, y, z);
    cloud.rotation.y = rand(0, Math.PI * 2);

    for (let p = 0; p < shape.puffs; p += 1) {
      const puff = new Mesh(this.geometry, this.material);
      // Flattened cluster: wide in X/Z, shallow in Y → bushy, not a ball.
      puff.position.set(
        rand(-shape.spread, shape.spread),
        rand(-0.5, 0.7),
        rand(-shape.spread * 0.7, shape.spread * 0.7),
      );
      const size = rand(1.0, 2.3);
      puff.scale.set(size, size * shape.flatten, size);
      puff.rotation.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI));
      cloud.add(puff);
    }

    this.group.add(cloud);
    return {
      group: cloud,
      baseY: y,
      bobAmplitude: rand(0.3, 1) * shape.bob,
      bobSpeed: rand(0.12, 0.28),
      phase: index * 1.7,
    };
  }

  update(_dt: number, t: number): void {
    // Slow orbital drift of the whole field around the board.
    this.group.rotation.y = t * DRIFT_SPEED;
    for (let i = 0; i < this.clouds.length; i += 1) {
      const cloud = this.clouds[i];
      cloud.group.position.y =
        cloud.baseY + Math.sin(t * cloud.bobSpeed + cloud.phase) * cloud.bobAmplitude;
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
