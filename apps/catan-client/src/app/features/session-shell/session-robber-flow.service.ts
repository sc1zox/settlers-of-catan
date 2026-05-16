import { inject, Injectable, signal } from '@angular/core';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslateService } from '@ngx-translate/core';
import {
  LobbyPlayerPublicDto,
  LobbySettlementDto,
  PlayerSeat,
} from '@catan/api-interfaces';
import { collectRobberVictimSeats } from '@catan/shared-game-field';
import { GameStateResource } from '../../core/game/game-state.resource';
import { RobberTilePick } from '../../game-canvas/game-canvas';
import { RobberVictimCandidate, RobberVictimModel } from '../../game-canvas/robber-victim-popover';
import { LobbyShellGameUiService } from '../lobby-game-ui/lobby-shell-game-ui.service';
import { ShellFeedbackService } from '../shell-feedback/shell-feedback.service';
import { totalResourceCards } from '../../shared/helper/lobby-game-ui/resource-card-totals';
import { UiFeedbackTone } from '../../shared/types/lobby-ui-state';

@Injectable()
export class SessionRobberFlowService {
  private readonly gameState = inject(GameStateResource);
  private readonly lobbyGameUi = inject(LobbyShellGameUiService);
  private readonly shellFeedback = inject(ShellFeedbackService);
  private readonly translate = inject(TranslateService);

  private readonly knightActiveSignal = signal<boolean>(false);
  public readonly knightActive = this.knightActiveSignal.asReadonly();

  private readonly pendingRobberCoord = signal<{ q: number; r: number } | null>(null);
  public readonly robberVictim = signal<RobberVictimModel | null>(null);

  public resetForSpectatorMode(): void {
    this.knightActiveSignal.set(false);
    this.pendingRobberCoord.set(null);
    this.robberVictim.set(null);
  }

  public setKnightActive(active: boolean): void {
    this.knightActiveSignal.set(active);
  }

  public onRobberTilePicked(pick: RobberTilePick): void {
    const payload = this.lobbyGameUi.rawLobbyState();
    if (
      payload !== undefined &&
      payload.robberCoord.q === pick.q &&
      payload.robberCoord.r === pick.r
    ) {
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Error,
        this.translate.instant(marker('reject.robberSameTile')),
      );
      return;
    }
    this.pendingRobberCoord.set({ q: pick.q, r: pick.r });
    const selfSeat = this.lobbyGameUi.selfSeat();
    let candidates: RobberVictimCandidate[] = [];
    if (payload !== undefined && selfSeat !== null) {
      const victimSeats = collectRobberVictimSeats(
        payload.tiles,
        payload.settlements.map((s: LobbySettlementDto) => ({
          seat: s.seat,
          vertexId: s.vertexId,
        })),
        payload.players.map((p: LobbyPlayerPublicDto) => ({
          seat: p.seat,
          totalResourceCards: totalResourceCards(p.resources),
        })),
        selfSeat,
        pick.q,
        pick.r,
      );
      const allowed = new Set(victimSeats);
      candidates = payload.players
        .filter((p: LobbyPlayerPublicDto) => allowed.has(p.seat))
        .map((p: LobbyPlayerPublicDto) => ({ seat: p.seat, name: p.displayName }));
    }
    this.robberVictim.set({ x: pick.x, y: pick.y, candidates });
  }

  public onRobberVictimPick(victimSeat: PlayerSeat | null): void {
    const coord = this.pendingRobberCoord();
    if (coord !== null) {
      if (this.knightActiveSignal()) {
        this.gameState.playKnight(coord.q, coord.r, victimSeat ?? undefined);
        this.knightActiveSignal.set(false);
      } else {
        this.gameState.moveRobber(coord.q, coord.r, victimSeat ?? undefined);
      }
    }
    this.pendingRobberCoord.set(null);
    this.robberVictim.set(null);
  }
}
