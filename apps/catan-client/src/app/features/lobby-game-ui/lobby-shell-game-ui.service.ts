import { inject, Injectable, Signal } from '@angular/core';
import { LobbyUiStep } from './lobby-ui-state';
import { LobbyActionCapabilitiesUiService } from './lobby-action-capabilities-ui.service';
import { LobbyDiscardUiService } from './lobby-discard-ui.service';
import { LobbyGameUiStateService } from './lobby-game-ui-state.service';
import { LobbyHudUiService } from './lobby-hud-ui.service';
import { TradeSessionService } from '../trading/trade-session.service';

@Injectable({ providedIn: 'root' })
export class LobbyShellGameUiService {
  private readonly core = inject(LobbyGameUiStateService);
  private readonly hud = inject(LobbyHudUiService);
  private readonly capabilities = inject(LobbyActionCapabilitiesUiService);
  private readonly tradeSession = inject(TradeSessionService);
  private readonly discardUi = inject(LobbyDiscardUiService);

  public attachUiStep(uiStep: Signal<LobbyUiStep>): void {
    this.core.attachUiStep(uiStep);
  }

  public readonly lobbyUiState = this.core.lobbyUiState;
  public readonly rawLobbyState = this.core.rawLobbyState;
  public readonly isLobbyLoading = this.core.isLobbyLoading;
  public readonly phaseLabel = this.core.phaseLabel;
  public readonly gameFinishedBannerText = this.core.gameFinishedBannerText;
  public readonly longestRoadLabel = this.core.longestRoadLabel;
  public readonly largestArmyLabel = this.core.largestArmyLabel;
  public readonly selfSeat = this.core.selfSeat;
  public readonly selfPlayer = this.core.selfPlayer;
  public readonly isSelfTurn = this.core.isSelfTurn;
  public readonly activeTurnPlayerName = this.core.activeTurnPlayerName;
  public readonly isLobbyAdmin = this.core.isLobbyAdmin;

  public readonly announcerEntry = this.hud.announcerEntry;
  public readonly hudGameplayLocked = this.hud.hudGameplayLocked;
  public readonly hudRobberDiscardSelf = this.hud.hudRobberDiscardSelf;
  public readonly hudShowPassiveWait = this.hud.hudShowPassiveWait;
  public readonly hudChromeSpectatorPaused = this.hud.hudChromeSpectatorPaused;

  public readonly canStartLobby = this.capabilities.canStartLobby;
  public readonly canFillLobbyWithBots = this.capabilities.canFillLobbyWithBots;
  public readonly canRollDice = this.capabilities.canRollDice;
  public readonly canFinishTrading = this.capabilities.canFinishTrading;
  public readonly canComposeNewTrade = this.capabilities.canComposeNewTrade;
  public readonly canEndTurn = this.capabilities.canEndTurn;
  public readonly canOpenTrade = this.capabilities.canOpenTrade;
  public readonly canMoveRobber = this.capabilities.canMoveRobber;
  public readonly canBuildSettlement = this.capabilities.canBuildSettlement;
  public readonly canBuildRoad = this.capabilities.canBuildRoad;
  public readonly canBuildCity = this.capabilities.canBuildCity;

  public readonly discardModel = this.discardUi.discardModel;
  public readonly tradePartners = this.tradeSession.tradePartners;
  public readonly pendingTrade = this.tradeSession.pendingTrade;
  public readonly selfTradeResources = this.tradeSession.selfResources;
  public readonly selfHarborRates = this.tradeSession.selfHarborRates;
  public readonly selfHasOpenTrade = this.tradeSession.selfHasOpenTrade;
}
