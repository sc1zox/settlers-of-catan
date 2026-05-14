import { GamePhase, ActionRejectCode } from '@catan/api-interfaces';

export class TurnStateMachine {
  private phase: GamePhase = GamePhase.Rolling;

  public getPhase(): GamePhase {
    return this.phase;
  }

  public assertOneOf(allowed: readonly GamePhase[]): void {
    if (!allowed.includes(this.phase)) {
      throw new Error(ActionRejectCode.WrongPhase);
    }
  }

  public setPhase(next: GamePhase): void {
    this.phase = next;
  }
}
