import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { GamePhase } from '@catan/api-interfaces';
import { BuildConfirmPopover } from '../../game-canvas/build-confirm-popover';
import { DiscardModal } from '../../game-canvas/discard-modal';
import { DevCardPlayPicker } from '../dev-cards/dev-card-play-picker';
import { GameCanvas } from '../../game-canvas/game-canvas';
import { RobberVictimPopover } from '../../game-canvas/robber-victim-popover';
import { TradePanel } from '../trading/trade-panel';
import { DisconnectBanner } from '../disconnect-banner/disconnect-banner';
import { SummaryScreen } from '../summary-screen/summary-screen';
import { GameSettingsToggle } from '../game-settings/game-settings-toggle';
import { SpectatorCameraToggle } from '../spectator-camera/spectator-camera-toggle';
import { PlayerStatsPanel } from '../player-stats-panel/player-stats-panel';
import { BonusAnnounceBanner } from '../bonus-announce-banner/bonus-announce-banner';
import { LobbyShellGameUiService } from '../lobby-game-ui/lobby-shell-game-ui.service';
import { SessionShellFacadeService } from './session-shell-facade.service';
import { SessionLobbyFlowService } from './session-lobby-flow.service';

@Component({
  selector: 'app-session-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    GameCanvas,
    BuildConfirmPopover,
    DiscardModal,
    DevCardPlayPicker,
    TradePanel,
    RobberVictimPopover,
    SpectatorCameraToggle,
    GameSettingsToggle,
    DisconnectBanner,
    SummaryScreen,
    PlayerStatsPanel,
    BonusAnnounceBanner,
    TranslatePipe,
  ],
  templateUrl: './session-shell.html',
  styleUrl: './session-shell.scss',
})
export class SessionShell {
  public readonly ui = inject(SessionShellFacadeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly lobbyGameUi = inject(LobbyShellGameUiService);
  private readonly lobbyFlow = inject(SessionLobbyFlowService);

  public constructor() {
    effect(() => {
      const phase = this.lobbyGameUi.lobbyUiState()?.phase;
      if (phase === GamePhase.LobbyWaiting) {
        const lobbyCode = this.route.parent?.snapshot.paramMap.get('lobbyCode') ?? '';
        if (lobbyCode.length > 0) {
          void this.router.navigate(['/lobby', lobbyCode]);
        }
      }
    });
  }
}
