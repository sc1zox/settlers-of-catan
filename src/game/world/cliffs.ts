import {
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface CliffsOptions {
  /** Outer radius at the water surface (cliff top). */
  readonly topRadius: number;
  /** World Y at the cliff top — should match the water level. */
  readonly topY: number;
  /** World Y at the cliff base — sits on the tabletop. */
  readonly bottomY: number;
  /** Seed for the deterministic stone layout. */
  readonly seed?: number;
}

/**
 * Stony cliff wall around the water disc, descending from the waterline down
 * to the tabletop. Built as a backing-wall (so any peek-through between stones
 * still reads as rock) plus several hundred merged hex/penta/hepta prisms
 * scattered in stacked bands. Each prism is randomly rotated and tilted so the
 * silhouette breaks up into individual rocks instead of a smooth ring.
 */
export class Cliffs {
  readonly group: Group = new Group();
  private readonly meshes: { mesh: Mesh; dispose(): void }[] = [];

  constructor(options: CliffsOptions) {
    const rng = makeRng(options.seed);

    const backing = buildBackingWall(options);
    this.group.add(backing.mesh);
    this.meshes.push(backing);

    const stones = buildStoneField(options, rng);
    this.group.add(stones.mesh);
    this.meshes.push(stones);
  }

  dispose(): void {
    for (const m of this.meshes) m.dispose();
  }
}

interface MeshHolder {
  readonly mesh: Mesh;
  dispose(): void;
}

/**
 * Smooth, dark cone-frustum sitting just inside the stone radius. Its only
 * job is to occlude the inside of the disc so any gap between stones still
 * shows rock, never empty scene.
 */
function buildBackingWall(options: CliffsOptions): MeshHolder {
  const segments = 64;
  const innerTop = options.topRadius - 0.15;
  const innerBot = options.topRadius + 0.35;

  const positions: number[] = [];
  const indices: number[] = [];

  // Top ring (vertices 0..segments-1).
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    positions.push(Math.cos(theta) * innerTop, options.topY, Math.sin(theta) * innerTop);
  }
  // Bottom ring (vertices segments..2*segments-1).
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    positions.push(Math.cos(theta) * innerBot, options.bottomY, Math.sin(theta) * innerBot);
  }
  // Outward-facing winding (CCW seen from outside the disc).
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    const a = i;
    const b = next;
    const c = segments + i;
    const d = segments + next;
    indices.push(a, b, d);
    indices.push(a, d, c);
  }

  const geom = new BufferGeometry();
  geom.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  const mat = new MeshStandardMaterial({
    color: 0x40382f,
    roughness: 1.0,
    metalness: 0.0,
    flatShading: true,
  });

  const mesh = new Mesh(geom, mat);
  mesh.receiveShadow = true;

  return {
    mesh,
    dispose() {
      geom.dispose();
      mat.dispose();
    },
  };
}

/**
 * Hundreds of tiny prisms placed around the disc rim, arranged in vertical
 * layers with angular and radial jitter so neighbouring stones overlap and
 * leave no visible seam along the wall.
 */
function buildStoneField(options: CliffsOptions, rng: () => number): MeshHolder {
  const cliffSpan = options.topY - options.bottomY;
  const layers = 5;
  const stonesPerLayer = 90;

  const margin = 0.25;
  // Each layer sits at a fraction of the cliff height, leaving a small margin
  // at the table and the waterline so the layout reads as stacked rocks.
  const usableSpan = cliffSpan - margin * 2;

  const geometries: BufferGeometry[] = [];

  for (let layer = 0; layer < layers; layer++) {
    const layerT = layer / Math.max(1, layers - 1);
    const layerY = options.bottomY + margin + usableSpan * layerT;
    // Stagger angular phase per layer so stones don't line up vertically.
    const phase = (layer % 2 === 0 ? 0 : Math.PI / stonesPerLayer) + layer * 0.013;

    for (let i = 0; i < stonesPerLayer; i++) {
      const baseTheta = (i / stonesPerLayer) * Math.PI * 2;
      const angularJitter = (rng() - 0.5) * ((Math.PI * 2) / stonesPerLayer) * 0.6;
      const theta = baseTheta + phase + angularJitter;

      const yJitter = (rng() - 0.5) * (cliffSpan / layers) * 0.55;
      const y = layerY + yJitter;

      // Stones bulge slightly outward from the backing wall.
      const radialOffset = 0.05 + rng() * 0.5;
      const r = options.topRadius + radialOffset;

      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;

      // Penta / hex / hepta prism for variety. Random taper so some stones
      // narrow toward the top.
      const radialSegs = 5 + Math.floor(rng() * 3);
      const radius = 0.42 + rng() * 0.55;
      const height = 0.55 + rng() * 0.85;
      const topFactor = 0.65 + rng() * 0.45;

      const stone = new CylinderGeometry(radius * topFactor, radius, height, radialSegs, 1);
      // Drop UVs — uniform attribute set is required for mergeGeometries.
      stone.deleteAttribute('uv');

      stone.rotateY(rng() * Math.PI * 2);
      stone.rotateZ((rng() - 0.5) * 0.45);
      stone.rotateX((rng() - 0.5) * 0.45);
      stone.translate(x, y, z);

      geometries.push(stone);
    }
  }

  const merged = mergeGeometries(geometries, false);
  for (const g of geometries) g.dispose();
  if (!merged) {
    throw new Error('Failed to merge cliff stone geometries — incompatible attribute sets.');
  }

  const mat = new MeshStandardMaterial({
    color: 0x80715f,
    roughness: 0.95,
    metalness: 0.0,
    flatShading: true,
  });

  const mesh = new Mesh(merged, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return {
    mesh,
    dispose() {
      merged.dispose();
      mat.dispose();
    },
  };
}

function makeRng(seed: number | undefined): () => number {
  if (seed === undefined) return Math.random;
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
