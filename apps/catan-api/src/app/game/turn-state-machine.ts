import { GamePhase, ActionRejectCode } from '@catan/api-interfaces';

/**
 * Authoritative phase machine for one lobby. Every transition is a single
 * method; the only way to read the phase is `getPhase()`. There is no public
 * `setPhase` on purpose — callers must go through a transition method so the
 * assertions cannot be bypassed.
 */
export class TurnStateMachine {
  private phase: GamePhase = GamePhase.LobbyWaiting;

  public getPhase(): GamePhase {
    return this.phase;
  }

  public isFinished(): boolean {
    return this.phase === GamePhase.Finished;
  }

  public assertOneOf(allowed: readonly GamePhase[]): void {
    if (!allowed.includes(this.phase)) {
      throw new Error(ActionRejectCode.WrongPhase);
    }
  }

  public onLobbyStarted(): void {
    this.assertOneOf([GamePhase.LobbyWaiting]);
    this.phase = GamePhase.SetupForward;
  }

  public onSetupForwardCompleted(): void {
    this.assertOneOf([GamePhase.SetupForward]);
    this.phase = GamePhase.SetupBackward;
  }

  public onSetupCompleted(): void {
    this.assertOneOf([GamePhase.SetupBackward]);
    this.phase = GamePhase.Rolling;
  }

  public onDiceResolved(rolledSeven: boolean, hasPendingRobberDiscard: boolean): void {
    this.assertOneOf([GamePhase.Rolling]);
    if (!rolledSeven) {
      this.phase = GamePhase.Trading;
      return;
    }
    if (hasPendingRobberDiscard) {
      this.phase = GamePhase.RobberDiscard;
      return;
    }
    this.phase = GamePhase.RobberMove;
  }

  public onDiscardRoundResolved(): void {
    this.assertOneOf([GamePhase.RobberDiscard]);
    this.phase = GamePhase.RobberMove;
  }

  public onRobberMoved(): void {
    this.assertOneOf([GamePhase.RobberMove]);
    this.phase = GamePhase.Trading;
  }

  public onTradingFinished(): void {
    this.assertOneOf([GamePhase.Trading]);
    this.phase = GamePhase.Building;
  }

  public onTurnEnded(): void {
    this.assertOneOf([GamePhase.Building]);
    this.phase = GamePhase.Rolling;
  }

  /**
   * Idempotent: collapsing into Finished from any other phase is allowed, and
   * a redundant call from Finished is a no-op. This is the only legal exit
   * once a winner has been declared.
   */
  public onWinnerDeclared(): void {
    if (this.phase === GamePhase.Finished) {
      return;
    }
    this.phase = GamePhase.Finished;
  }
}
