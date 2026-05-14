import { GamePhase, ActionRejectCode } from '@catan/api-interfaces';

export class TurnStateMachine {
  private phase: GamePhase = GamePhase.LobbyWaiting;

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

  public onLobbyWaiting(): void {
    this.phase = GamePhase.LobbyWaiting;
  }

  public onLobbyStarted(): void {
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
    this.assertOneOf([GamePhase.Building, GamePhase.EndTurn]);
    this.phase = GamePhase.Rolling;
  }
}
