import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { BonusAwardKind } from '@catan/api-interfaces';
import { GameStateResource } from '../../core/game/game-state.resource';

interface BonusAnnouncement {
  readonly id: number;
  readonly text: string;
}

const DISMISS_AFTER_MS = 4000;

/**
 * Transient banner triggered by the `BonusAwarded` socket event. Rides the same
 * signal as the bonus card fly-in (game-canvas effect), so the banner and the
 * flight stay atomic. Auto-dismisses after a few seconds.
 */
@Component({
  selector: 'app-bonus-announce-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bonus-announce-banner.html',
  styleUrl: './bonus-announce-banner.scss',
})
export class BonusAnnounceBanner {
  private readonly gameState = inject(GameStateResource);
  private readonly translate = inject(TranslateService);

  protected readonly announcement = signal<BonusAnnouncement | null>(null);
  private nextId = 0;
  private dismissHandle: ReturnType<typeof setTimeout> | null = null;

  private readonly awardSync = effect((onCleanup) => {
    const award = this.gameState.bonusAwarded.value();
    if (award === undefined) {
      return;
    }
    const lobby = this.gameState.lobby.value();
    const recipient = lobby?.players.find((p) => p.seat === award.recipientSeat);
    const playerName = recipient?.displayName ?? '';
    const key =
      award.kind === BonusAwardKind.LongestRoad
        ? marker('bonusAnnounce.longestRoad')
        : marker('bonusAnnounce.largestArmy');
    const text = this.translate.instant(key, { playerName });
    this.nextId += 1;
    this.announcement.set({ id: this.nextId, text });
    if (this.dismissHandle !== null) {
      clearTimeout(this.dismissHandle);
    }
    this.dismissHandle = setTimeout(() => {
      this.announcement.set(null);
      this.dismissHandle = null;
    }, DISMISS_AFTER_MS);
    onCleanup(() => {
      if (this.dismissHandle !== null) {
        clearTimeout(this.dismissHandle);
        this.dismissHandle = null;
      }
    });
  });
}
