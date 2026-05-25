import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { SessionShellFacadeService } from './session-shell-facade.service';
import { SessionLobbyFlowService } from './session-lobby-flow.service';
import { SessionBuildInteractionService } from './session-build-interaction.service';
import { SessionRobberFlowService } from './session-robber-flow.service';
import { SessionTradingPanelService } from './session-trading-panel.service';
import { SessionDevCardOverlayService } from './session-dev-card-overlay.service';
import { SessionCleanupService } from './session-cleanup.service';

@Component({
  selector: 'app-lobby-parent',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: '<router-outlet />',
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
export class LobbyParent {
  private readonly cleanup = inject(SessionCleanupService);
  private readonly lobbyFlow = inject(SessionLobbyFlowService);
  private readonly route = inject(ActivatedRoute);

  public constructor() {
    effect(() => {
      const lobbyCode = this.route.snapshot.paramMap.get('lobbyCode') ?? '';
      if (lobbyCode.length > 0) {
        this.lobbyFlow.connectToLobbyFromRoute(lobbyCode);
      }
    });
  }
}
