import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
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
  template: `
    @if (rows().length > 0) {
      <aside class="player-stats" role="complementary" [attr.aria-label]="ariaLabel()">
        <header class="player-stats__header">
          <span>{{ 'playerStats.title' | translate }}</span>
        </header>
        <ul class="player-stats__list">
          @for (row of rows(); track row.seat) {
            <li
              class="player-stats__row"
              [class.player-stats__row--self]="row.isSelf"
            >
              <div class="player-stats__name">
                <span>{{ row.displayName }}</span>
                @if (row.isBot) {
                  <span class="player-stats__bot-badge">{{ 'playerStats.botBadge' | translate }}</span>
                }
              </div>
              <dl class="player-stats__metrics">
                <div class="player-stats__metric">
                  <dt>{{ 'playerStats.vp' | translate }}</dt>
                  <dd>{{ row.visibleVictoryPoints }}</dd>
                </div>
                <div class="player-stats__metric">
                  <dt>{{ 'playerStats.knights' | translate }}</dt>
                  <dd>{{ row.playedKnights }}</dd>
                </div>
                <div class="player-stats__metric">
                  <dt>{{ 'playerStats.longestRoad' | translate }}</dt>
                  <dd>{{ row.longestRoadLength }}</dd>
                </div>
              </dl>
              @if (row.hasLongestRoad || row.hasLargestArmy) {
                <div class="player-stats__badges">
                  @if (row.hasLongestRoad) {
                    <span class="player-stats__badge player-stats__badge--longest-road">
                      {{ 'playerStats.badgeLongestRoad' | translate }}
                    </span>
                  }
                  @if (row.hasLargestArmy) {
                    <span class="player-stats__badge player-stats__badge--largest-army">
                      {{ 'playerStats.badgeLargestArmy' | translate }}
                    </span>
                  }
                </div>
              }
            </li>
          }
        </ul>
      </aside>
    }
  `,
  styleUrl: './player-stats-panel.scss',
})
export class PlayerStatsPanel {
  private readonly gameState = inject(GameStateResource);
  private readonly translate = inject(TranslateService);

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

  public ariaLabel(): string {
    return this.translate.instant(marker('playerStats.ariaLabel'));
  }
}
