import { inject, Injectable, signal } from '@angular/core';
import { DevCardType, ResourceType } from '@catan/api-interfaces';
import { GameStateResource } from '../../core/game/game-state.resource';
import {
  DevCardPlayPickerModel,
  YearOfPlentyPick,
} from '../dev-cards/dev-card-play-picker';
import { DevCardsService } from '../dev-cards/dev-cards.service';
import { SessionBuildInteractionService } from './session-build-interaction.service';
import { SessionRobberFlowService } from './session-robber-flow.service';

/**
 * Routes a "play this specific dev card" intent (from the focused-card overlay
 * in game-canvas) to the right follow-up:
 *  - Knight        → enter robber mode (server play happens after tile/victim picked)
 *  - Monopoly      → open resource picker → server PlayMonopoly
 *  - YearOfPlenty  → open two-resource picker → server PlayYearOfPlenty
 *  - RoadBuilding  → enter free-road mode (server play happens after edge picked)
 *  - VictoryPoint  → not playable (filtered upstream)
 *
 * The server is the source of truth: every action calls a GameStateResource
 * method that emits the matching socket event; the canPlay gate is just an
 * optimistic UI hint to keep an unplayable card from opening a picker.
 */
@Injectable()
export class SessionDevCardOverlayService {
  private readonly gameState = inject(GameStateResource);
  private readonly devCards = inject(DevCardsService);
  private readonly build = inject(SessionBuildInteractionService);
  private readonly robberFlow = inject(SessionRobberFlowService);

  public readonly pickerModel = signal<DevCardPlayPickerModel>(null);

  /** Wipe local picker state. Called by the session cleanup coordinator. */
  public resetSession(): void {
    this.pickerModel.set(null);
  }

  public onPlayDevCard(type: DevCardType): void {
    if (!this.devCards.canPlayDevCard()) {
      return;
    }
    switch (type) {
      case DevCardType.Knight:
        this.robberFlow.setKnightActive(true);
        return;
      case DevCardType.RoadBuilding:
        this.build.onPlayRoadBuilding();
        return;
      case DevCardType.Monopoly:
        this.pickerModel.set({ kind: 'monopoly' });
        return;
      case DevCardType.YearOfPlenty:
        this.pickerModel.set({ kind: 'yearOfPlenty' });
        return;
      case DevCardType.VictoryPoint:
        return;
    }
  }

  public closePicker(): void {
    this.pickerModel.set(null);
  }

  public onMonopolyPicked(resource: ResourceType): void {
    if (!this.devCards.canPlayDevCard()) {
      return;
    }
    this.gameState.playMonopoly(resource);
    this.pickerModel.set(null);
  }

  public onPlentyPicked(pick: YearOfPlentyPick): void {
    if (!this.devCards.canPlayDevCard()) {
      return;
    }
    this.gameState.playYearOfPlenty(pick.first, pick.second);
    this.pickerModel.set(null);
  }
}
