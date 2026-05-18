import { inject, Injectable, signal } from '@angular/core';
import { BuildKind } from '@catan/api-interfaces';
import { GameStateResource } from '../../core/game/game-state.resource';
import { BuildConfirmModel } from '../../game-canvas/build-confirm-popover';
import { LobbyShellGameUiService } from '../lobby-game-ui/lobby-shell-game-ui.service';

@Injectable()
export class SessionBuildInteractionService {
  private readonly gameState = inject(GameStateResource);
  private readonly lobbyGameUi = inject(LobbyShellGameUiService);

  public readonly buildMode = signal<BuildKind | null>(null);
  public readonly freeRoadMode = signal<boolean>(false);
  public readonly buildConfirm = signal<BuildConfirmModel | null>(null);
  private readonly roadBuildingFirstEdgeId = signal<string | null>(null);

  /** Wipe local mode state. Called by the session cleanup coordinator. */
  public resetSession(): void {
    this.buildMode.set(null);
    this.freeRoadMode.set(false);
    this.buildConfirm.set(null);
    this.roadBuildingFirstEdgeId.set(null);
  }

  public onArsenalBuild(kind: BuildKind): void {
    if (kind === BuildKind.Settlement && this.lobbyGameUi.canBuildSettlement()) {
      this.enterBuildMode(BuildKind.Settlement);
    } else if (kind === BuildKind.Road && this.lobbyGameUi.canBuildRoad()) {
      this.enterBuildMode(BuildKind.Road);
    } else if (kind === BuildKind.City && this.lobbyGameUi.canBuildCity()) {
      this.enterBuildMode(BuildKind.City);
    }
  }

  public onBuildSpotPicked(model: BuildConfirmModel): void {
    this.buildConfirm.set(model);
  }

  public confirmBuild(): void {
    const pending = this.buildConfirm();
    if (pending === null) {
      return;
    }
    this.buildConfirm.set(null);
    if (this.freeRoadMode()) {
      const firstEdgeId = this.roadBuildingFirstEdgeId();
      if (firstEdgeId === null) {
        this.roadBuildingFirstEdgeId.set(pending.id);
        return;
      }
      this.gameState.playRoadBuilding(firstEdgeId, pending.id);
      this.exitBuildMode();
      return;
    }
    if (pending.kind === BuildKind.Settlement) {
      this.gameState.buildSettlement(pending.id);
    } else if (pending.kind === BuildKind.Road) {
      this.gameState.buildRoad(pending.id);
    } else {
      this.gameState.buildCity(pending.id);
    }
    this.exitBuildMode();
  }

  public cancelBuild(): void {
    this.buildConfirm.set(null);
  }

  public onBuildModeCancelled(): void {
    this.exitBuildMode();
  }

  public onPlayRoadBuilding(): void {
    this.roadBuildingFirstEdgeId.set(null);
    this.buildConfirm.set(null);
    this.freeRoadMode.set(true);
    this.buildMode.set(BuildKind.Road);
  }

  private enterBuildMode(kind: BuildKind): void {
    this.freeRoadMode.set(false);
    this.roadBuildingFirstEdgeId.set(null);
    this.buildConfirm.set(null);
    this.buildMode.set(kind);
  }

  private exitBuildMode(): void {
    this.buildMode.set(null);
    this.freeRoadMode.set(false);
    this.roadBuildingFirstEdgeId.set(null);
    this.buildConfirm.set(null);
  }
}
