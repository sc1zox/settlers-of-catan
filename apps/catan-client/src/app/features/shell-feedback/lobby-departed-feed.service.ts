import { DestroyRef, effect, Injectable, inject, signal } from '@angular/core';
import {
  GamePhase,
  type LobbyFullStatePayload,
  type LobbyPlayerPublicDto,
  PlayerSeat,
} from '@catan/api-interfaces';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslateService } from '@ngx-translate/core';
import { GameStateResource } from '../../core/game/game-state.resource';
import type { LobbyActivityFeedEntry } from '../../shared/types/lobby-ui-state';

interface LobbyHumanSnapshot {
  readonly lobbyId: string;
  readonly phase: GamePhase;
  readonly humansExcludingSelf: readonly SeatDisplayPair[];
}

interface SeatDisplayPair {
  readonly seat: PlayerSeat;
  readonly displayName: string;
}

@Injectable({ providedIn: 'root' })
export class LobbyDepartedFeedService {
  private readonly gameState = inject(GameStateResource);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private snapshot: LobbyHumanSnapshot | null = null;
  private serial = 0;
  private readonly pendingDismiss = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly entryTtlMs = 7600;

  public readonly entries = signal<readonly LobbyActivityFeedEntry[]>([]);

  public constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearDismissTimers();
      this.entries.set([]);
    });
    effect(() => {
      const subscription = this.gameState.subscriptionParams();
      if (subscription === undefined) {
        this.snapshot = null;
        this.clearDismissTimers();
        this.entries.set([]);
        return;
      }
      const lobby = this.gameState.lobby.value();
      if (lobby === undefined) {
        return;
      }
      if (this.snapshot !== null && this.snapshot.lobbyId !== lobby.lobbyId) {
        this.snapshot = this.captureSnapshot(lobby);
        return;
      }
      const priorSnapshot = this.snapshot;
      if (priorSnapshot === null) {
        this.snapshot = this.captureSnapshot(lobby);
        return;
      }
      const lines = this.collectDepartureTexts(priorSnapshot, lobby);
      this.snapshot = this.captureSnapshot(lobby);
      for (let i = 0; i < lines.length; i += 1) {
        this.enqueueEntry(lines[i]!);
      }
    });
  }

  private clearDismissTimers(): void {
    const keys = Array.from(this.pendingDismiss.keys());
    for (let i = 0; i < keys.length; i += 1) {
      const handle = this.pendingDismiss.get(keys[i]!);
      if (handle !== undefined) {
        clearTimeout(handle);
      }
    }
    this.pendingDismiss.clear();
  }

  private captureSnapshot(payload: LobbyFullStatePayload): LobbyHumanSnapshot {
    return {
      lobbyId: payload.lobbyId,
      phase: payload.phase,
      humansExcludingSelf: this.pickHumanGuests(payload.players),
    };
  }

  private pickHumanGuests(players: readonly LobbyPlayerPublicDto[]): SeatDisplayPair[] {
    const out: SeatDisplayPair[] = [];
    for (let i = 0; i < players.length; i += 1) {
      const player = players[i]!;
      if (player.isBot || player.isSelf) {
        continue;
      }
      out.push({ seat: player.seat, displayName: player.displayName });
    }
    return out;
  }

  private matchesHumanSeat(
    players: readonly LobbyPlayerPublicDto[],
    seat: PlayerSeat,
    displayName: string,
  ): boolean {
    for (let i = 0; i < players.length; i += 1) {
      const player = players[i]!;
      if (player.isBot) {
        continue;
      }
      if (player.seat === seat && player.displayName === displayName) {
        return true;
      }
    }
    return false;
  }

  private collectDepartureTexts(
    prev: LobbyHumanSnapshot,
    nextPayload: LobbyFullStatePayload,
  ): string[] {
    const texts: string[] = [];
    for (let i = 0; i < prev.humansExcludingSelf.length; i += 1) {
      const previousGuest = prev.humansExcludingSelf[i]!;
      if (
        !this.matchesHumanSeat(
          nextPayload.players,
          previousGuest.seat,
          previousGuest.displayName,
        )
      ) {
        texts.push(
          this.departureSentence(previousGuest.displayName, prev.phase),
        );
      }
    }
    return texts;
  }

  private departureSentence(displayName: string, phaseBefore: GamePhase): string {
    if (phaseBefore === GamePhase.LobbyWaiting) {
      return this.translate.instant(marker('shell.playerLeftLobby'), {
        playerName: displayName,
      });
    }
    return this.translate.instant(marker('shell.playerLeftGame'), {
      playerName: displayName,
    });
  }

  private enqueueEntry(text: string): void {
    this.serial += 1;
    const id = `${Date.now().toString(36)}_${this.serial.toString(36)}`;
    this.entries.update((rows) => [...rows, { id, text }]);
    const dismissHandle = setTimeout(() => {
      this.pendingDismiss.delete(id);
      this.entries.update((rows) => {
        const next = rows.filter((row) => row.id !== id);
        return next;
      });
    }, this.entryTtlMs);
    this.pendingDismiss.set(id, dismissHandle);
  }
}
