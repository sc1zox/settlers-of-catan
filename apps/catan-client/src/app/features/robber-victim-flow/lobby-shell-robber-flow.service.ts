import { computed, inject, Injectable, signal } from '@angular/core';
import { PlayerSeat } from '@catan/api-interfaces';
import { RobberTilePick } from '../../game-canvas/game-canvas';
import { RobberVictimCandidate, RobberVictimModel } from '../../game-canvas/robber-victim-popover';
import { LobbyShellGameUiService } from '../lobby-game-ui/lobby-shell-game-ui.service';
import { GameStateResource } from '../../core/game/game-state.resource';
import { buildRobberVictimCandidates } from '../../shared/helper/robber-victim-flow/robber-victim-candidates';

@Injectable()
export class LobbyShellRobberFlowService {
  private readonly gameState = inject(GameStateResource);
  private readonly lobbyGameUi = inject(LobbyShellGameUiService);

  private readonly knightActive = signal<boolean>(false);
  private readonly pendingRobberCoord = signal<{ q: number; r: number } | null>(null);
  public readonly robberVictim = signal<RobberVictimModel | null>(null);

  public readonly robberMode = computed<boolean>(
    () => this.lobbyGameUi.canMoveRobber() || this.knightActive(),
  );

  public onRobberTilePicked(pick: RobberTilePick): void {
    this.pendingRobberCoord.set({ q: pick.q, r: pick.r });
    const payload = this.lobbyGameUi.rawLobbyState();
    const selfSeat = this.lobbyGameUi.selfSeat();
    let candidates: RobberVictimCandidate[] = [];
    if (payload !== undefined && selfSeat !== null) {
      candidates = buildRobberVictimCandidates(payload, selfSeat, pick);
    }
    this.robberVictim.set({ x: pick.x, y: pick.y, candidates });
  }

  public onRobberVictimPick(victimSeat: PlayerSeat | null): void {
    const coord = this.pendingRobberCoord();
    if (coord !== null) {
      if (this.knightActive()) {
        this.gameState.playKnight(coord.q, coord.r, victimSeat ?? undefined);
        this.knightActive.set(false);
      } else {
        this.gameState.moveRobber(coord.q, coord.r, victimSeat ?? undefined);
      }
    }
    this.pendingRobberCoord.set(null);
    this.robberVictim.set(null);
  }

  public beginKnightRobberPlacement(): void {
    this.knightActive.set(true);
  }
}
