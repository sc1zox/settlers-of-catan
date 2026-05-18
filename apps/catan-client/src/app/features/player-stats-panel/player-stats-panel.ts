import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { PlayerSeat } from '@catan/api-interfaces';
import { GameStateResource } from '../../core/game/game-state.resource';

interface PlayerStatsRow {
  readonly seat: PlayerSeat;
  readonly displayName: string;
  readonly visibleVictoryPoints: number;
  readonly playedKnights: number;
  readonly longestRoadLength: number;
  readonly hasLongestRoad: boolean;
  readonly hasLargestArmy: boolean;
  readonly isSelf: boolean;
  readonly isBot: boolean;
}

@Component({
  selector: 'app-player-stats-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './player-stats-panel.html',
  styleUrl: './player-stats-panel.scss',
})
export class PlayerStatsPanel {
  private readonly gameState = inject(GameStateResource);
  private readonly translate = inject(TranslateService);

  public readonly expanded = signal(false);

  public readonly rows = computed<readonly PlayerStatsRow[]>(() => {
    const lobby = this.gameState.lobby.value();
    if (lobby === undefined) {
      return [];
    }
    const out: PlayerStatsRow[] = [];
    for (let i = 0; i < lobby.players.length; i += 1) {
      const p = lobby.players[i];
      out.push({
        seat: p.seat,
        displayName: p.displayName,
        visibleVictoryPoints: p.visibleVictoryPoints,
        playedKnights: p.playedKnights,
        longestRoadLength: p.longestRoadLength,
        hasLongestRoad: lobby.longestRoadSeat === p.seat,
        hasLargestArmy: lobby.largestArmySeat === p.seat,
        isSelf: p.isSelf,
        isBot: p.isBot,
      });
    }
    out.sort((a, b) => a.seat - b.seat);
    return out;
  });

  public toggleExpanded(): void {
    this.expanded.update((open) => !open);
  }

  public ariaLabel(): string {
    return this.translate.instant(marker('playerStats.ariaLabel'));
  }

  public toggleAriaLabel(): string {
    const key = this.expanded()
      ? marker('playerStats.ariaCollapse')
      : marker('playerStats.ariaExpand');
    return this.translate.instant(key);
  }
}
