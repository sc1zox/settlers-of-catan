import { Group, Vector3 } from 'three';
import { Die } from './die';

export interface DiceRollResult {
  readonly a: number;
  readonly b: number;
  readonly sum: number;
}

export type DiceResultHandler = (result: DiceRollResult) => void;

export interface DiceTrayOptions {
  readonly tableTopY: number;
  /** Centre of the two-die layout on the tabletop (x, z). */
  readonly anchor: { readonly x: number; readonly z: number };
  readonly dieSize?: number;
}

/**
 * Two dice resting on the tabletop. Clicking either one rolls both with a
 * tumble animation; after they settle the registered handler receives the
 * pair of values.
 */
export class DiceTray {
  readonly group: Group = new Group();
  readonly dice: readonly [Die, Die];
  private handler: DiceResultHandler | null = null;
  private rolling = false;
  private resultEmitted = false;

  constructor(options: DiceTrayOptions) {
    const size = options.dieSize ?? 1.05;
    const yCenter = options.tableTopY + size / 2 + 0.02;
    const spread = size * 1.35;
    const a = new Die({
      size,
      restPosition: new Vector3(options.anchor.x - spread / 2, yCenter, options.anchor.z),
    });
    const b = new Die({
      size,
      restPosition: new Vector3(options.anchor.x + spread / 2, yCenter, options.anchor.z),
    });
    this.dice = [a, b];
    this.group.add(a.mesh, b.mesh);
  }

  setResultHandler(handler: DiceResultHandler | null): void {
    this.handler = handler;
  }

  /** Triggered by a click on either die — both tumble together. */
  rollBoth(): void {
    if (this.rolling) return;
    this.rolling = true;
    this.resultEmitted = false;
    for (const die of this.dice) {
      die.beginRoll(1 + Math.floor(Math.random() * 6));
    }
  }

  /** Public alias — same as rollBoth. */
  roll(): void {
    this.rollBoth();
  }

  update(dt: number): void {
    for (const die of this.dice) die.update(dt);
    if (this.rolling && !this.dice[0].isRolling() && !this.dice[1].isRolling()) {
      this.rolling = false;
      if (!this.resultEmitted) {
        this.resultEmitted = true;
        const a = this.dice[0].getValue();
        const b = this.dice[1].getValue();
        this.handler?.({ a, b, sum: a + b });
      }
    }
  }

  dispose(): void {
    for (const die of this.dice) die.dispose();
  }
}
