import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
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
import { SessionLobbyFlowService } from './session-lobby-flow.service';
import { SessionBuildInteractionService } from './session-build-interaction.service';
import { SessionRobberFlowService } from './session-robber-flow.service';
import { SessionTradingPanelService } from './session-trading-panel.service';
import { SessionDevCardOverlayService } from './session-dev-card-overlay.service';
import { SessionShellFacadeService } from './session-shell-facade.service';
import { SessionCleanupService } from './session-cleanup.service';

@Component({
  selector: 'app-session-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    GameCanvas,
    ReactiveFormsModule,
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
  providers: [
    SessionShellFacadeService,
    SessionLobbyFlowService,
    SessionBuildInteractionService,
    SessionRobberFlowService,
    SessionTradingPanelService,
    SessionDevCardOverlayService,
    SessionCleanupService,
  ],
})
export class SessionShell {
  public readonly ui = inject(SessionShellFacadeService);
  private readonly cleanup = inject(SessionCleanupService);
}
