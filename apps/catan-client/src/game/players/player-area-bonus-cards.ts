import { Group, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { BonusAwardKind } from '@catan/api-interfaces';
import { Card } from '../cards/card';
import { createBonusCard } from '../cards/bonus-card';

export interface PlayerAreaBonusCardsOptions {
  readonly group: Group;
  readonly seat: number;
  readonly tableTopY: number;
  readonly cardRowZ: number;
}

const BONUS_CARD_THICKNESS = 0.04;
const BONUS_CARD_WIDTH = 1.0;
const BONUS_CARD_DEPTH = 0.7;

/**
 * Bonus award cards (Längste Handelsstraße / Größte Rittermacht) belonging to
 * one seat. Owns the card meshes + their backing materials; PlayerArea forwards
 * lifecycle calls (setBonusCard / update / dispose / presence dim) here.
 */
export class PlayerAreaBonusCards {
  private readonly cards = new Map<BonusAwardKind, Card>();
  private readonly materials = new Map<BonusAwardKind, MeshStandardMaterial[]>();
  private presenceDimmed = false;

  public constructor(private readonly options: PlayerAreaBonusCardsOptions) {}

  public get count(): number {
    return this.cards.size;
  }

  /**
   * All currently-owned bonus cards for this seat. Used by hover/inspect logic
   * so the engine can route clicks to focus mode regardless of holder.
   */
  public listCards(): readonly Card[] {
    return Array.from(this.cards.values());
  }

  public getCard(kind: BonusAwardKind): Card | undefined {
    return this.cards.get(kind);
  }

  public ownsCard(card: Card): boolean {
    for (const owned of this.cards.values()) {
      if (owned === card) {
        return true;
      }
    }
    return false;
  }

  /**
   * Add or remove an award card from the outer card row. The mesh persists
   * across re-syncs so an in-flight animation can drive it directly.
   * Returns the card when `owned === true` (creating one if needed), otherwise
   * `null` after disposing the previously-held card.
   */
  public set(kind: BonusAwardKind, owned: boolean): Card | null {
    if (owned) {
      const existing = this.cards.get(kind);
      if (existing) {
        return existing;
      }
      const bonus = createBonusCard({
        kind,
        width: BONUS_CARD_WIDTH,
        depth: BONUS_CARD_DEPTH,
        thickness: BONUS_CARD_THICKNESS,
      });
      bonus.card.setGroupKey(`bonus-${this.options.seat}-${kind}`);
      bonus.card.setBasePose(this.restPosition(kind), this.restQuaternion(kind));
      this.options.group.add(bonus.card.mesh);
      this.cards.set(kind, bonus.card);
      this.materials.set(kind, [...bonus.materials]);
      bonus.card.setPresenceDimmed(this.presenceDimmed);
      return bonus.card;
    }
    const existing = this.cards.get(kind);
    if (!existing) {
      return null;
    }
    existing.setMode('rest');
    this.options.group.remove(existing.mesh);
    existing.dispose();
    this.cards.delete(kind);
    const mats = this.materials.get(kind);
    if (mats) {
      for (let i = 0; i < mats.length; i += 1) {
        mats[i].map?.dispose();
        mats[i].dispose();
      }
      this.materials.delete(kind);
    }
    return null;
  }

  public setPresenceDimmed(dimmed: boolean): void {
    if (this.presenceDimmed === dimmed) {
      return;
    }
    this.presenceDimmed = dimmed;
    for (const card of this.cards.values()) {
      card.setPresenceDimmed(dimmed);
    }
  }

  public update(dt: number): void {
    for (const card of this.cards.values()) {
      card.update(dt);
    }
  }

  public dispose(): void {
    for (const card of this.cards.values()) {
      this.options.group.remove(card.mesh);
      card.dispose();
    }
    for (const mats of this.materials.values()) {
      for (let i = 0; i < mats.length; i += 1) {
        mats[i].map?.dispose();
        mats[i].dispose();
      }
    }
    this.cards.clear();
    this.materials.clear();
  }

  /**
   * Layout slots between the cost card (X ≈ -5.2) and the hand (X ≈ -2.7) so
   * both award cards fit without overlapping either neighbour. The card lives
   * in the seat-rotated group, so X/Z are seat-local.
   */
  private restPosition(kind: BonusAwardKind): Vector3 {
    const slotX = kind === BonusAwardKind.LongestRoad ? -4.6 : -3.45;
    return new Vector3(
      slotX,
      this.options.tableTopY + BONUS_CARD_THICKNESS / 2 + 0.005,
      this.options.cardRowZ,
    );
  }

  private restQuaternion(kind: BonusAwardKind): Quaternion {
    // Flip the card face-up (face material is on the -Y face) and add a tiny
    // seat-specific yaw jitter so the two awards don't look machine-stamped.
    const yaw = kind === BonusAwardKind.LongestRoad ? 0.05 : -0.06;
    return new Quaternion()
      .setFromAxisAngle(new Vector3(1, 0, 0), Math.PI)
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw));
  }
}
