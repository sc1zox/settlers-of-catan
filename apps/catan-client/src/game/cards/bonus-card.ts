import { MeshStandardMaterial } from 'three';
import { BonusAwardKind } from '@catan/api-interfaces';
import { Card } from './card';
import { makeBonusCardBackTexture, makeBonusCardTexture } from './textures-bonus-card';

/** Landscape "award" card lying on the table (long edge along world X). */
export interface BonusCardOptions {
  readonly kind: BonusAwardKind;
  /** Long side (mapped to local X). */
  readonly width: number;
  /** Card thickness (mapped to local Y). */
  readonly thickness: number;
  /** Depth toward the player (mapped to local Z). */
  readonly depth: number;
}

export interface BonusCardResult {
  readonly card: Card;
  readonly materials: readonly MeshStandardMaterial[];
}

/**
 * Award card (Längste Handelsstraße / Größte Rittermacht). Built on top of the
 * regular `Card` mesh so it inherits hover + focus-mode rendering — the
 * fly-in animation reuses focus mode's depth-test override so the card paints
 * over the rest of the scene while it's airborne.
 */
export function createBonusCard(options: BonusCardOptions): BonusCardResult {
  const faceTex = makeBonusCardTexture(options.kind);
  const backTex = makeBonusCardBackTexture();
  const faceMat = new MeshStandardMaterial({ map: faceTex, roughness: 0.85, flatShading: true });
  const backMat = new MeshStandardMaterial({ map: backTex, roughness: 0.85, flatShading: true });
  const edgeMat = new MeshStandardMaterial({ color: 0x6b4a26, flatShading: true });

  // Card constructor: `height` is local X (short axis), `width` is local Z
  // (long axis). We want the card landscape with the long side along world X
  // so it reads from across the table, so map our `width` to `height` here.
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
