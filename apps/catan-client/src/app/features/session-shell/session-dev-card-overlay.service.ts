import { inject, Injectable, signal } from '@angular/core';
import { ResourceType } from '@catan/api-interfaces';
import { GameStateResource } from '../../core/game/game-state.resource';
import { YearOfPlentyPick } from '../dev-cards/dev-card-modal';
import { DevCardsService } from '../dev-cards/dev-cards.service';
import { SessionBuildInteractionService } from './session-build-interaction.service';
import { SessionRobberFlowService } from './session-robber-flow.service';

@Injectable()
export class SessionDevCardOverlayService {
  private readonly gameState = inject(GameStateResource);
  private readonly devCards = inject(DevCardsService);
  private readonly build = inject(SessionBuildInteractionService);
  private readonly robberFlow = inject(SessionRobberFlowService);

  public readonly devCardOpen = signal<boolean>(false);

  /** Wipe local mode state. Called by the session cleanup coordinator. */
  public resetSession(): void {
    this.devCardOpen.set(false);
  }

  public onDevCardClicked(): boolean {
    const canPlay = this.devCards.canPlayDevCard();
    if (canPlay) {
      this.devCardOpen.set(true);
    }
    return canPlay;
  }

  public closeDevCard(): void {
    this.devCardOpen.set(false);
  }

  public onPlayKnight(): void {
    this.devCardOpen.set(false);
    this.robberFlow.setKnightActive(true);
  }

  public onPlayMonopoly(resource: ResourceType): void {
    this.gameState.playMonopoly(resource);
    this.devCardOpen.set(false);
  }

  public onPlayYearOfPlenty(pick: YearOfPlentyPick): void {
    this.gameState.playYearOfPlenty(pick.first, pick.second);
    this.devCardOpen.set(false);
  }

  public onPlayRoadBuilding(): void {
    this.devCardOpen.set(false);
    this.build.onPlayRoadBuilding();
  }
}
