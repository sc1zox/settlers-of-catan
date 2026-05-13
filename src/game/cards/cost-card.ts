import { BoxGeometry, Material, Mesh, MeshStandardMaterial } from 'three';
import { makeCostCardTexture } from './textures';

export interface CostCardOptions {
  /** Long horizontal side (X). */
  readonly width: number;
  /** Card thickness (Y). */
  readonly thickness: number;
  /** Depth (Z) — toward player. */
  readonly depth: number;
}

export interface CostCardResult {
  readonly mesh: Mesh;
  readonly materials: readonly MeshStandardMaterial[];
}

/** Face-up reference card that lists the building costs. */
export function createCostCard(options: CostCardOptions): CostCardResult {
  const tex = makeCostCardTexture();
  const faceMat = new MeshStandardMaterial({ map: tex, flatShading: true, roughness: 0.85 });
  const backMat = new MeshStandardMaterial({ color: 0x8a6c40, flatShading: true });
  const edgeMat = new MeshStandardMaterial({ color: 0x6b4a26, flatShading: true });
  // Material order: +X, -X, +Y, -Y, +Z, -Z — face-up means face texture on +Y.
  const mats: Material[] = [edgeMat, edgeMat, faceMat, backMat, edgeMat, edgeMat];
  const mesh = new Mesh(
    new BoxGeometry(options.width, options.thickness, options.depth),
    mats,
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return { mesh, materials: [faceMat, backMat, edgeMat] };
}
