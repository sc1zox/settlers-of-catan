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
 * Two dice resting on the tabletop. `rollTo` tumbles both towards the
 * server-authoritative values; after they settle the registered handler
 * receives the pair.
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

  /** Tumble both dice towards the given server-authoritative face values. */
  rollTo(a: number, b: number): void {
    if (this.rolling) return;
    this.rolling = true;
    this.resultEmitted = false;
    this.dice[0].beginRoll(a);
    this.dice[1].beginRoll(b);
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
