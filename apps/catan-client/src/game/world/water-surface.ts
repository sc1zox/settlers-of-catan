import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
} from 'three';

/** Vertex layout for the disc: 1 centre vertex + ring * radial. */
interface DiscGeometry {
  geometry: BufferGeometry;
  baseY: Float32Array;
  positions: BufferAttribute;
  ringCount: number;
  radialSegments: number;
}

function buildDiscGeometry(
  radius: number,
  ringCount: number,
  radialSegments: number,
): DiscGeometry {
  const positions: number[] = [0, 0, 0];
  for (let ring = 1; ring <= ringCount; ring++) {
    // Power curve so vertex density is higher near the centre (better wave detail
    // close to land, fewer wasted verts at the disc rim).
    const r = Math.pow(ring / ringCount, 0.85) * radius;
    for (let i = 0; i < radialSegments; i++) {
      const theta = (i / radialSegments) * Math.PI * 2;
      positions.push(Math.cos(theta) * r, 0, Math.sin(theta) * r);
    }
  }
  const indices: number[] = [];
  // Winding: CCW when viewed from above (+Y looking down) so the top face is
  // the front face. Vertices walk clockwise in XZ (since +Z is "south"), so the
  // index order is centre → next → i to flip the winding to CCW from above.
  for (let i = 0; i < radialSegments; i++) {
    const next = (i + 1) % radialSegments;
    indices.push(0, 1 + next, 1 + i);
  }
  for (let ring = 1; ring < ringCount; ring++) {
    const ringStart = 1 + (ring - 1) * radialSegments;
    const nextRingStart = 1 + ring * radialSegments;
    for (let i = 0; i < radialSegments; i++) {
      const next = (i + 1) % radialSegments;
      indices.push(ringStart + i, nextRingStart + next, nextRingStart + i);
      indices.push(ringStart + i, ringStart + next, nextRingStart + next);
    }
  }

  const positionAttr = new Float32BufferAttribute(positions, 3);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', positionAttr);
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // Cache the original Y so we can re-displace from a clean base each frame.
  const baseY = new Float32Array(positions.length / 3);
  for (let i = 0; i < baseY.length; i++) baseY[i] = 0;

  return { geometry, baseY, positions: positionAttr, ringCount, radialSegments };
}

/**
 * Round water surface that fills the disc around the land. Vertices are
 * displaced per frame to create a few rolling waves.
 */
export class WaterSurface {
  readonly mesh: Mesh;
  private readonly disc: DiscGeometry;

  constructor(radius: number) {
    this.disc = buildDiscGeometry(radius, 14, 64);
    const material = new MeshStandardMaterial({
      color: 0x1f6fa8,
      roughness: 0.25,
      metalness: 0.3,
      flatShading: true,
      // Double-sided so wave-displaced normals never flip the visible face away.
      side: DoubleSide,
    });
    this.mesh = new Mesh(this.disc.geometry, material);
    this.mesh.receiveShadow = true;
  }

  update(t: number): void {
    const pos = this.disc.positions.array as Float32Array;
    // Four overlapping wave fronts with bigger amplitudes so the surface
    // visibly ripples instead of looking like a flat blue disc.
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i];
      const z = pos[i + 2];
      const r = Math.sqrt(x * x + z * z);
      const wave =
        Math.sin(t * 0.9 + x * 0.55 + z * 0.3) * 0.22 +
        Math.sin(t * 1.4 - x * 0.32 + z * 0.62) * 0.16 +
        Math.sin(t * 1.9 + r * 0.7) * 0.1 +
        Math.sin(t * 2.6 - x * 0.85 - z * 0.4) * 0.06;
      pos[i + 1] = wave;
    }
    this.disc.positions.needsUpdate = true;
    this.disc.geometry.computeVertexNormals();
  }

  dispose(): void {
    this.disc.geometry.dispose();
    (this.mesh.material as MeshStandardMaterial).dispose();
  }
}
