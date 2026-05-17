import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslateService } from '@ngx-translate/core';
import { PlayerSeat } from '@catan/api-interfaces';
import { interval } from 'rxjs';
import { GameStateResource } from '../../core/game/game-state.resource';
import { LobbyShellGameUiService } from '../lobby-game-ui/lobby-shell-game-ui.service';

interface DisconnectRowVm {
  readonly seat: PlayerSeat;
  readonly displayName: string;
  readonly remainingMs: number | null;
  readonly awaitingAdminDecision: boolean;
}

@Component({
  selector: 'app-disconnect-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rows().length > 0) {
      <aside class="disconnect-banner" role="status" aria-live="polite">
        @for (row of rows(); track row.seat) {
          <div class="disconnect-banner__row">
            <span class="disconnect-banner__dot" aria-hidden="true"></span>
            <div class="disconnect-banner__text">
              <strong class="disconnect-banner__name">{{ row.displayName }}</strong>
              @if (row.awaitingAdminDecision) {
                <span>{{ awaitingText() }}</span>
              } @else if (row.remainingMs !== null) {
                <span>{{ countdownText(row.remainingMs) }}</span>
              }
            </div>
            @if (row.awaitingAdminDecision && isAdmin()) {
              <button
                type="button"
                class="disconnect-banner__kick"
                (click)="kick(row.seat)"
              >
                {{ kickButtonText() }}
              </button>
            }
          </div>
        }
      </aside>
    }
  `,
  styleUrl: './disconnect-banner.scss',
})
export class DisconnectBanner implements OnInit {
  private readonly gameUi = inject(LobbyShellGameUiService);
  private readonly gameState = inject(GameStateResource);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly tick = signal<number>(Date.now());

  public readonly isAdmin = computed<boolean>(() => this.gameUi.isLobbyAdmin());

  public readonly rows = computed<readonly DisconnectRowVm[]>(() => {
    const raw = this.gameUi.rawLobbyState();
    if (raw === undefined) {
      return [];
    }
    const now = this.tick();
    const out: DisconnectRowVm[] = [];
    for (let i = 0; i < raw.players.length; i += 1) {
      const p = raw.players[i];
      if (p.isBot) {
        continue;
      }
      if (p.isConnected) {
        continue;
      }
      if (p.disconnectGraceExpiresAt === null && !p.awaitingAdminDecision) {
        continue;
      }
      const remainingMs =
        p.disconnectGraceExpiresAt !== null
          ? Math.max(0, p.disconnectGraceExpiresAt - now)
          : null;
      out.push({
        seat: p.seat,
        displayName: p.displayName,
        remainingMs,
        awaitingAdminDecision: p.awaitingAdminDecision,
      });
    }
    return out;
  });

  public ngOnInit(): void {
    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.tick.set(Date.now()));
  }

  public kick(seat: PlayerSeat): void {
    this.gameState.kickAndReplaceWithBot(seat);
  }

  public countdownText(remainingMs: number): string {
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const formatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    return this.translate.instant(marker('disconnectBanner.reconnectIn'), {
      countdown: formatted,
    });
  }

  public awaitingText(): string {
    return this.translate.instant(marker('disconnectBanner.awaitingAdmin'));
  }

  public kickButtonText(): string {
    return this.translate.instant(marker('disconnectBanner.kickButton'));
  }
}
