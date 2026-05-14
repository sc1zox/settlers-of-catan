import { MeshStandardMaterial } from 'three';
import { Card } from './card';
import { makeCostCardBackTexture, makeCostCardTexture } from './textures';

export interface CostCardOptions {
  /** Long horizontal side (X). */
  readonly width: number;
  /** Card thickness (Y). */
  readonly thickness: number;
  /** Depth (Z) — toward player. */
  readonly depth: number;
}

export interface CostCardResult {
  readonly card: Card;
  readonly materials: readonly MeshStandardMaterial[];
}

/**
 * Reference card listing the building costs. Built as a regular `Card` so it
 * shares the focus-on-click behaviour with the resource and dev hands. The
 * card rests face-up — set its base quaternion to a 180° X-axis flip in the
 * caller so the cost listing is visible from above on the table.
 */
export function createCostCard(options: CostCardOptions): CostCardResult {
  const faceTex = makeCostCardTexture();
  const backTex = makeCostCardBackTexture();
  const faceMat = new MeshStandardMaterial({ map: faceTex, roughness: 0.85, flatShading: true });
  const backMat = new MeshStandardMaterial({ map: backTex, roughness: 0.85, flatShading: true });
  const edgeMat = new MeshStandardMaterial({ color: 0x6b4a26, flatShading: true });

  // Card constructor uses `height` for local X (short axis) and `width` for
  // local Z (long axis). The cost card is landscape — its X is the long side.
  const card = new Card({
    width: options.depth,
    height: options.width,
    thickness: options.thickness,
    backMaterial: backMat,
    faceMaterial: faceMat,
    edgeMaterial: edgeMat,
  });

  return { card, materials: [faceMat, backMat, edgeMat] };
}
