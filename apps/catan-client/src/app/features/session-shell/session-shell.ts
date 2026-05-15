import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  BuildKind,
  DefaultDisplayName,
  GamePhase,
  KnownLobbyId,
  LiveKitCredentialsPayload,
  PlayerSeat,
  ResourceType,
  isLobbyCodeValid,
} from '@catan/api-interfaces';
import { collectRobberVictimSeats } from '@catan/shared-game-field';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { GameStateResource } from '../../core/game/game-state.resource';
import { PlayerSessionService } from '../../core/session/player-session.service';
import { GameSettingsService } from '../game-settings/game-settings.service';
import { LobbyLiveKitService } from '../webcam-head/lobby-livekit.service';
import { BuildConfirmModel, BuildConfirmPopoverComponent } from '../../game-canvas/build-confirm-popover';
import { DiscardModalComponent } from '../../game-canvas/discard-modal';
import { DevCardModalComponent, YearOfPlentyPick } from '../dev-cards/dev-card-modal';
import { DevCardsService } from '../dev-cards/dev-cards.service';
import { GameCanvasComponent, RobberTilePick } from '../../game-canvas/game-canvas';
import {
  RobberVictimCandidate,
  RobberVictimModel,
  RobberVictimPopoverComponent,
} from '../../game-canvas/robber-victim-popover';
import {
  BankTradeRequest,
  ProposeTradeRequest,
  TradePanelComponent,
} from '../../game-canvas/trade-panel';
import { LobbyUiStep, SessionUiState, UiFeedbackTone } from '../../shared/types/lobby-ui-state';
import { LobbyShellGameUiService } from '../lobby-game-ui/lobby-shell-game-ui.service';
import { totalResourceCards } from '../../shared/helper/lobby-game-ui/resource-card-totals';
import { ShellFeedbackService } from '../shell-feedback/shell-feedback.service';
import { SpectatorCameraService } from '../spectator-camera/spectator-camera.service';
import { GameSettingsToggle } from '../game-settings/game-settings-toggle';
import { SpectatorCameraToggle } from '../spectator-camera/spectator-camera-toggle';
@Component({
  selector: 'app-session-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    GameCanvasComponent,
    ReactiveFormsModule,
    BuildConfirmPopoverComponent,
    DiscardModalComponent,
    DevCardModalComponent,
    TradePanelComponent,
    RobberVictimPopoverComponent,
    SpectatorCameraToggle,
    GameSettingsToggle,
    TranslatePipe,
  ],
  templateUrl: './session-shell.html',
  styleUrl: './session-shell.scss',
})
export class SessionShell {
  private readonly fb = inject(FormBuilder);
  private readonly gameState = inject(GameStateResource);
  public readonly lobbyGameUi = inject(LobbyShellGameUiService);
  public readonly devCards = inject(DevCardsService);
  public readonly shellFeedback = inject(ShellFeedbackService);
  private readonly playerSession = inject(PlayerSessionService);
  private readonly liveKit = inject(LobbyLiveKitService);
  public readonly gameSettings = inject(GameSettingsService);
  public readonly spectatorCamService = inject(SpectatorCameraService);
  private readonly translate = inject(TranslateService);

  public readonly uiStep = signal<LobbyUiStep>(LobbyUiStep.SignIn);
  public readonly sessionState = signal<SessionUiState | null>(null);
  public readonly joinInProgress = signal<boolean>(false);
  public readonly sessionForm = this.fb.nonNullable.group({
    displayName: this.fb.nonNullable.control<string>(DefaultDisplayName.PlayerDe, {
      validators: [Validators.required, Validators.minLength(2)],
    }),
  });
  public readonly lobbyForm = this.fb.nonNullable.group({
    lobbyCode: this.fb.nonNullable.control<string>(KnownLobbyId.DemoClient, {
      validators: [Validators.required, Validators.minLength(2)],
    }),
  });

  public readonly buildMode = signal<BuildKind | null>(null);
  public readonly freeRoadMode = signal<boolean>(false);
  public readonly buildConfirm = signal<BuildConfirmModel | null>(null);
  private readonly roadBuildingFirstEdgeId = signal<string | null>(null);
  private readonly knightActive = signal<boolean>(false);
  private readonly pendingRobberCoord = signal<{ q: number; r: number } | null>(null);
  public readonly robberVictim = signal<RobberVictimModel | null>(null);
  public readonly tradeOpen = signal<boolean>(false);
  public readonly devCardOpen = signal<boolean>(false);
  public readonly isJoinInProgress = computed<boolean>(() => this.joinInProgress());

  public readonly robberMode = computed<boolean>(
    () => this.lobbyGameUi.canMoveRobber() || this.knightActive(),
  );

  private readonly phaseSync = effect(() => {
    const state = this.lobbyGameUi.lobbyUiState();
    if (state === null) {
      return;
    }
    if (state.phase === GamePhase.LobbyWaiting) {
      if (this.uiStep() === LobbyUiStep.InGame) {
        this.uiStep.set(LobbyUiStep.Lobby);
      }
      return;
    }
    if (this.uiStep() !== LobbyUiStep.InGame) {
      this.uiStep.set(LobbyUiStep.InGame);
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Success,
        this.translate.instant(marker('shell.gameStarted')),
      );
    }
  });

  private readonly exploreModeUiReset = effect(() => {
    if (!this.spectatorCamService.mode()) {
      return;
    }
    this.buildMode.set(null);
    this.freeRoadMode.set(false);
    this.buildConfirm.set(null);
    this.roadBuildingFirstEdgeId.set(null);
    this.knightActive.set(false);
    this.pendingRobberCoord.set(null);
    this.robberVictim.set(null);
    this.tradeOpen.set(false);
    this.devCardOpen.set(false);
  });

  private readonly spectatorSignInGuard = effect(() => {
    if (this.uiStep() === LobbyUiStep.SignIn) {
      this.spectatorCamService.reset();
    }
  });

  public constructor() {
    this.lobbyGameUi.attachUiStep(this.uiStep);
  }

  public readonly lobbyUiStep = LobbyUiStep;
  public readonly uiFeedbackTone = UiFeedbackTone;

  public lobbyCodeValue(): string {
    return this.lobbyForm.controls.lobbyCode.value;
  }

  public activeLobbyCode(): string {
    return (
      this.lobbyGameUi.lobbyUiState()?.lobbyCode ??
      this.gameState.connection()?.lobbyCode ??
      this.lobbyCodeValue()
    );
  }

  public startSession(): void {
    if (this.sessionForm.invalid) {
      this.sessionForm.markAllAsTouched();
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Error,
        this.translate.instant(marker('shell.nameTooShort')),
      );
      return;
    }
    void this.runStartSession();
  }

  public joinLobby(): void {
    if (this.lobbyForm.invalid) {
      this.lobbyForm.markAllAsTouched();
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Error,
        this.translate.instant(marker('shell.lobbyCodeTooShort')),
      );
      return;
    }
    void this.runJoinLobby();
  }

  public onWebcamEnabledChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.gameSettings.setWebcamEnabled(input.checked);
    if (input.checked) {
      this.beginWebcamPrimingIfEnabledAndSecure();
    } else {
      void this.liveKit.abandonPrimedLocalVideoCapture();
    }
  }

  public backToSignIn(): void {
    void this.liveKit.abandonPrimedLocalVideoCapture();
    this.joinInProgress.set(false);
    this.spectatorCamService.reset();
    this.uiStep.set(LobbyUiStep.SignIn);
    this.shellFeedback.setFeedback(
      UiFeedbackTone.Info,
      this.translate.instant(marker('shell.backToSignIn')),
    );
  }

  public backToJoinLobby(): void {
    void this.liveKit.abandonPrimedLocalVideoCapture();
    void this.liveKit.disconnect();
    this.gameState.disconnectLobby();
    this.joinInProgress.set(false);
    this.spectatorCamService.reset();
    this.uiStep.set(LobbyUiStep.JoinLobby);
    this.shellFeedback.setFeedback(
      UiFeedbackTone.Info,
      this.translate.instant(marker('shell.backToJoinLobby')),
    );
  }

  public resetSession(): void {
    void this.liveKit.abandonPrimedLocalVideoCapture();
    void this.liveKit.disconnect();
    this.gameState.disconnectLobby();
    this.playerSession.clear();
    this.sessionState.set(null);
    this.joinInProgress.set(false);
    this.shellFeedback.clearFeedback();
    this.spectatorCamService.reset();
    this.uiStep.set(LobbyUiStep.SignIn);
  }

  public startLobby(): void {
    this.gameState.startLobby();
  }

  public rollDice(): void {
    if (!this.lobbyGameUi.canRollDice()) {
      return;
    }
    this.gameState.rollDice();
  }

  public finishTrading(): void {
    this.gameState.finishTrading();
  }

  public endTurn(): void {
    this.gameState.endTurn();
  }

  public buyDevCard(): void {
    this.gameState.buyDevCard();
  }

  public onArsenalBuild(kind: BuildKind): void {
    if (kind === BuildKind.Settlement && this.lobbyGameUi.canBuildSettlement()) {
      this.enterBuildMode(BuildKind.Settlement);
    } else if (kind === BuildKind.Road && this.lobbyGameUi.canBuildRoad()) {
      this.enterBuildMode(BuildKind.Road);
    } else if (kind === BuildKind.City && this.lobbyGameUi.canBuildCity()) {
      this.enterBuildMode(BuildKind.City);
    }
  }

  public onBuildSpotPicked(model: BuildConfirmModel): void {
    this.buildConfirm.set(model);
  }

  public confirmBuild(): void {
    const pending = this.buildConfirm();
    if (pending === null) {
      return;
    }
    this.buildConfirm.set(null);
    if (this.freeRoadMode()) {
      const firstEdgeId = this.roadBuildingFirstEdgeId();
      if (firstEdgeId === null) {
        this.roadBuildingFirstEdgeId.set(pending.id);
        return;
      }
      this.gameState.playRoadBuilding(firstEdgeId, pending.id);
      this.exitBuildMode();
      return;
    }
    if (pending.kind === BuildKind.Settlement) {
      this.gameState.buildSettlement(pending.id);
    } else if (pending.kind === BuildKind.Road) {
      this.gameState.buildRoad(pending.id);
    } else {
      this.gameState.buildCity(pending.id);
    }
  }

  public cancelBuild(): void {
    this.buildConfirm.set(null);
  }

  public onBuildModeCancelled(): void {
    this.exitBuildMode();
  }

  private enterBuildMode(kind: BuildKind): void {
    this.freeRoadMode.set(false);
    this.roadBuildingFirstEdgeId.set(null);
    this.buildConfirm.set(null);
    this.buildMode.set(kind);
  }

  private exitBuildMode(): void {
    this.buildMode.set(null);
    this.freeRoadMode.set(false);
    this.roadBuildingFirstEdgeId.set(null);
    this.buildConfirm.set(null);
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
        payload.settlements.map((s) => ({ seat: s.seat, vertexId: s.vertexId })),
        payload.players.map((p) => ({
          seat: p.seat,
          totalResourceCards: totalResourceCards(p.resources),
        })),
        selfSeat,
        pick.q,
        pick.r,
      );
      const allowed = new Set(victimSeats);
      candidates = payload.players
        .filter((p) => allowed.has(p.seat))
        .map((p) => ({ seat: p.seat, name: p.displayName }));
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

  public openTrade(): void {
    this.tradeOpen.set(true);
  }

  public closeTrade(): void {
    this.tradeOpen.set(false);
  }

  public onBankTrade(request: BankTradeRequest): void {
    this.gameState.bankTrade(request.give, request.amount, request.receive);
    this.tradeOpen.set(false);
  }

  public onProposeTrade(request: ProposeTradeRequest): void {
    this.gameState.proposeTrade(request.toSeat, request.offer, request.request);
    this.tradeOpen.set(false);
  }

  public onAcceptTrade(tradeId: string): void {
    this.gameState.acceptTrade(tradeId);
    this.tradeOpen.set(false);
  }

  public onRejectTrade(tradeId: string): void {
    this.gameState.rejectTrade(tradeId);
  }

  public onDevCardClicked(): void {
    if (this.devCards.canPlayDevCard()) {
      this.devCardOpen.set(true);
    }
  }

  public closeDevCard(): void {
    this.devCardOpen.set(false);
  }

  public onPlayKnight(): void {
    this.devCardOpen.set(false);
    this.knightActive.set(true);
  }

  public onPlayMonopoly(resource: ResourceType): void {
    this.gameState.playMonopoly(resource);
    this.devCardOpen.set(false);
  }

  public onPlayYearOfPlenty(pick: YearOfPlentyPick): void {
    this.gameState.playYearOfPlenty(pick.first, pick.second);
    this.devCardOpen.set(false);
  }

  public onPlayRoadBuilding(): void {
    this.devCardOpen.set(false);
    this.roadBuildingFirstEdgeId.set(null);
    this.buildConfirm.set(null);
    this.freeRoadMode.set(true);
    this.buildMode.set(BuildKind.Road);
  }

  public onSubmitDiscard(discard: Readonly<Record<ResourceType, number>>): void {
    this.gameState.submitRobberDiscard(discard);
  }

  private async runStartSession(): Promise<void> {
    const normalizedDisplayName = this.sessionForm.controls.displayName.value.trim();
    if (normalizedDisplayName.length < 2) {
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Error,
        this.translate.instant(marker('shell.nameTooShortRun')),
      );
      return;
    }
    this.beginWebcamPrimingIfEnabledAndSecure();
    let sid = this.playerSession.sessionId();
    if (sid.length === 0) {
      await this.playerSession.ensureReady();
      sid = this.playerSession.sessionId();
    }
    if (sid.length === 0) {
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Error,
        this.translate.instant(marker('shell.sessionStartFailed')),
      );
      return;
    }
    this.sessionState.set({ displayName: normalizedDisplayName, sessionId: sid });
    this.uiStep.set(LobbyUiStep.JoinLobby);
    this.shellFeedback.setFeedback(
      UiFeedbackTone.Success,
      this.translate.instant(marker('shell.welcomeNamed'), {
        userName: normalizedDisplayName,
      }),
    );
  }

  private beginWebcamPrimingIfEnabledAndSecure(): void {
    if (!this.gameSettings.webcamEnabled()) {
      return;
    }
    if (typeof globalThis.isSecureContext === 'boolean' && !globalThis.isSecureContext) {
      return;
    }
    this.liveKit.beginLocalVideoCaptureFromUserGesture();
  }

  private blockLobbyJoinIfWebcamRequiresSecureContext(): boolean {
    if (!this.gameSettings.webcamEnabled()) {
      return true;
    }
    if (typeof globalThis.isSecureContext === 'boolean' && !globalThis.isSecureContext) {
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Error,
        this.translate.instant(marker('shell.webcamInsecureContext')),
      );
      return false;
    }
    return true;
  }

  private connectLiveKitInBackground(credentials: LiveKitCredentialsPayload): void {
    void this.liveKit.connect(credentials).catch((error: unknown) => {
      console.error('LiveKit connect failed', credentials.serverUrl, error);
      const detail =
        error instanceof Error
          ? SessionShell.truncateLiveKitDetail(error.message)
          : SessionShell.truncateLiveKitDetail(String(error));
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Info,
        this.translate.instant(marker('shell.liveKitConnectFailed'), { detail }),
      );
    });
  }

  private static truncateLiveKitDetail(raw: string): string {
    const oneLine = raw.replace(/\s+/gu, ' ').trim();
    if (oneLine.length <= 160) {
      return oneLine;
    }
    return `${oneLine.slice(0, 157)}...`;
  }

  private async runJoinLobby(): Promise<void> {
    const session = this.sessionState();
    if (session === null) {
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Error,
        this.translate.instant(marker('shell.sessionMissing')),
      );
      this.uiStep.set(LobbyUiStep.SignIn);
      return;
    }
    const lobbyCodeInput = this.lobbyForm.controls.lobbyCode.value.trim();
    if (!isLobbyCodeValid(lobbyCodeInput)) {
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Error,
        this.translate.instant(marker('shell.lobbyCodeTooShortRun')),
      );
      return;
    }
    if (!this.blockLobbyJoinIfWebcamRequiresSecureContext()) {
      return;
    }
    this.joinInProgress.set(true);
    this.shellFeedback.setFeedback(
      UiFeedbackTone.Info,
      this.translate.instant(marker('shell.joinConnecting'), {
        lobbyCode: lobbyCodeInput,
      }),
    );
    try {
      const joined = await this.gameState.connectToLobby(lobbyCodeInput, session.displayName);
      this.uiStep.set(LobbyUiStep.Lobby);
      this.joinInProgress.set(false);
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Success,
        this.translate.instant(marker('shell.joinSuccess'), {
          lobbyCode: joined.lobbyCode,
        }),
      );
      if (joined.liveKit !== undefined) {
        this.connectLiveKitInBackground(joined.liveKit);
      }
    } catch {
      void this.liveKit.abandonPrimedLocalVideoCapture();
      void this.liveKit.disconnect();
      this.gameState.disconnectLobby();
      this.joinInProgress.set(false);
      this.shellFeedback.setFeedback(
        UiFeedbackTone.Error,
        this.translate.instant(marker('shell.joinFailed'), {
          lobbyCode: lobbyCodeInput,
        }),
      );
    }
  }
}
