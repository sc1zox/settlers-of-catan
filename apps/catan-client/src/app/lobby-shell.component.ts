import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  BuildKind,
  DefaultDisplayName,
  GamePhase,
  KnownLobbyId,
  LobbyFullStatePayload,
  LobbyPlayerPublicDto,
  PlayerSeat,
  ResourceType,
  TradeOfferDto,
} from '@catan/api-interfaces';
import { GameCanvasComponent, RobberTilePick } from './game-canvas/game-canvas';
import { BuildConfirmModel, BuildConfirmPopoverComponent } from './game-canvas/build-confirm-popover';
import { DiscardModalComponent, DiscardModalModel } from './game-canvas/discard-modal';
import { DevCardModalComponent, YearOfPlentyPick } from './game-canvas/dev-card-modal';
import {
  BankTradeRequest,
  ProposeTradeRequest,
  TradePanelComponent,
  TradePartner,
} from './game-canvas/trade-panel';
import {
  RobberVictimCandidate,
  RobberVictimModel,
  RobberVictimPopoverComponent,
} from './game-canvas/robber-victim-popover';
import { SpectatorCameraService, SpectatorCameraToggleComponent } from './features/spectator-camera';
import { GameStateResource } from './game/game-state.resource';
import {
  LobbySeatUiState,
  LobbyUiState,
  LobbyUiStep,
  SessionUiState,
  UiFeedbackState,
  UiFeedbackTone,
} from './shared/types/lobby-ui-state';
import { PlayerSessionService } from './http/player-session.service';
import { collectRobberVictimSeats } from '@catan/shared-game-field';

@Component({
  selector: 'app-lobby-shell',
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
    SpectatorCameraToggleComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class LobbyShellComponent {
  private readonly fb = inject(FormBuilder);
  private readonly gameState = inject(GameStateResource);
  private readonly playerSession = inject(PlayerSessionService);
  private readonly spectatorCamService = inject(SpectatorCameraService);

  public readonly uiStep = signal<LobbyUiStep>(LobbyUiStep.SignIn);
  public readonly feedback = signal<UiFeedbackState | null>(null);
  public readonly sessionState = signal<SessionUiState | null>(null);
  public readonly joinInProgress = signal<boolean>(false);
  public readonly sessionForm = this.fb.nonNullable.group({
    displayName: this.fb.nonNullable.control<string>(DefaultDisplayName.PlayerDe, {
      validators: [Validators.required, Validators.minLength(2)],
    }),
  });
  public readonly lobbyForm = this.fb.nonNullable.group({
    lobbyId: this.fb.nonNullable.control<string>(KnownLobbyId.DemoClient, {
      validators: [Validators.required, Validators.minLength(2)],
    }),
  });

  // === In-game interaction state ===
  /** Active build kind — drives the 3D ghost figures. */
  public readonly buildMode = signal<BuildKind | null>(null);
  /** When true the road ghosts use the cost-free road-building dev-card list. */
  public readonly freeRoadMode = signal<boolean>(false);
  /** Pending build-spot confirmation popover. */
  public readonly buildConfirm = signal<BuildConfirmModel | null>(null);
  /** Road-building dev card in progress — holds the first chosen edge. */
  private readonly roadBuildingFirstEdgeId = signal<string | null>(null);
  /** Knight card played: robber placement is active outside the RobberMove phase. */
  private readonly knightActive = signal<boolean>(false);
  /** Robber tile picked, waiting for victim selection. */
  private readonly pendingRobberCoord = signal<{ q: number; r: number } | null>(null);
  public readonly robberVictim = signal<RobberVictimModel | null>(null);
  public readonly tradeOpen = signal<boolean>(false);
  public readonly devCardOpen = signal<boolean>(false);

  public readonly lobbyUiState = computed<LobbyUiState | null>(() => {
    const lobbyState = this.gameState.lobby.value();
    if (lobbyState === undefined) {
      return null;
    }
    return this.mapLobbyState(lobbyState);
  });

  private readonly rawLobbyState = computed<LobbyFullStatePayload | undefined>(() =>
    this.gameState.lobby.value(),
  );

  public readonly isLobbyLoading = computed<boolean>(() => this.gameState.lobby.isLoading());
  public readonly isJoinInProgress = computed<boolean>(() => this.joinInProgress());
  public readonly activeSeatLabel = computed<string>(() => {
    const state = this.lobbyUiState();
    return state === null ? '-' : this.seatLabel(state.activeSeat);
  });
  public readonly phaseLabel = computed<string>(() => {
    const state = this.lobbyUiState();
    return state === null ? '-' : this.phaseToLabel(state.phase);
  });
  public readonly longestRoadLabel = computed<string>(() => {
    const state = this.lobbyUiState();
    if (state === null || state.longestRoadSeat === null) {
      return '-';
    }
    return this.seatLabel(state.longestRoadSeat);
  });
  public readonly largestArmyLabel = computed<string>(() => {
    const state = this.lobbyUiState();
    if (state === null || state.largestArmySeat === null) {
      return '-';
    }
    return this.seatLabel(state.largestArmySeat);
  });
  public readonly winnerLabel = computed<string>(() => {
    const state = this.lobbyUiState();
    if (state === null || state.winnerSeat === null) {
      return '-';
    }
    return this.seatLabel(state.winnerSeat);
  });
  public readonly selfSeat = computed<PlayerSeat | null>(() => {
    const state = this.lobbyUiState();
    if (state === null) {
      return null;
    }
    for (let i = 0; i < state.seats.length; i += 1) {
      if (state.seats[i].isSelf) {
        return state.seats[i].seat;
      }
    }
    return null;
  });
  private readonly selfPlayer = computed<LobbyPlayerPublicDto | undefined>(() => {
    const payload = this.rawLobbyState();
    if (payload === undefined) {
      return undefined;
    }
    return payload.players.find((player) => player.isSelf);
  });
  public readonly isSelfTurn = computed<boolean>(() => {
    const state = this.lobbyUiState();
    const seat = this.selfSeat();
    if (state === null || seat === null) {
      return false;
    }
    return state.activeSeat === seat;
  });
  public readonly isLobbyAdmin = computed<boolean>(() => {
    const state = this.lobbyUiState();
    if (state === null) {
      return false;
    }
    for (let i = 0; i < state.seats.length; i += 1) {
      if (state.seats[i].isSelf) {
        return state.seats[i].seat === state.adminSeat;
      }
    }
    return false;
  });
  public readonly canStartLobby = computed<boolean>(
    () => this.isLobbyAdmin() && this.lobbyUiState()?.phase === GamePhase.LobbyWaiting,
  );
  public readonly canRollDice = computed<boolean>(
    () => this.isSelfTurn() && this.lobbyUiState()?.phase === GamePhase.Rolling,
  );
  public readonly canFinishTrading = computed<boolean>(
    () => this.isSelfTurn() && this.lobbyUiState()?.phase === GamePhase.Trading,
  );
  public readonly canEndTurn = computed<boolean>(
    () => this.isSelfTurn() && this.lobbyUiState()?.phase === GamePhase.Building,
  );
  public readonly canOpenTrade = computed<boolean>(
    () => this.lobbyUiState()?.phase === GamePhase.Trading,
  );
  public readonly canBuyDevCard = computed<boolean>(() => this.canEndTurn());
  public readonly canPlayDevCard = computed<boolean>(() => {
    const phase = this.lobbyUiState()?.phase;
    return this.isSelfTurn() && (phase === GamePhase.Trading || phase === GamePhase.Building);
  });
  public readonly canMoveRobber = computed<boolean>(
    () => this.isSelfTurn() && this.lobbyUiState()?.phase === GamePhase.RobberMove,
  );

  private readonly setupPendingRoadVertexId = computed<string | null>(() => {
    const state = this.lobbyUiState();
    const seat = this.selfSeat();
    if (state === null || seat === null || state.pendingSetupRoadSeat !== seat) {
      return null;
    }
    return state.pendingSetupRoadFromVertexId;
  });
  public readonly canBuildSettlement = computed<boolean>(() => {
    const state = this.lobbyUiState();
    const seat = this.selfSeat();
    if (state === null) {
      return false;
    }
    const setupPendingForSelf =
      seat !== null &&
      state.pendingSetupRoadSeat === seat &&
      state.pendingSetupRoadFromVertexId !== null;
    return (
      this.isSelfTurn() &&
      (state.phase === GamePhase.Building ||
        ((state.phase === GamePhase.SetupForward || state.phase === GamePhase.SetupBackward) &&
          !setupPendingForSelf))
    );
  });
  public readonly canBuildRoad = computed<boolean>(() => {
    const state = this.lobbyUiState();
    if (state === null || !this.isSelfTurn()) {
      return false;
    }
    if (state.phase === GamePhase.Building) {
      return true;
    }
    if (state.phase === GamePhase.SetupForward || state.phase === GamePhase.SetupBackward) {
      return this.setupPendingRoadVertexId() !== null;
    }
    return false;
  });
  public readonly canBuildCity = computed<boolean>(() => this.canEndTurn());

  /** Robber placement is active either during RobberMove or after a Knight card. */
  public readonly robberMode = computed<boolean>(
    () => this.canMoveRobber() || this.knightActive(),
  );

  public readonly discardModel = computed<DiscardModalModel | null>(() => {
    const state = this.lobbyUiState();
    const seat = this.selfSeat();
    const self = this.selfPlayer();
    if (state === null || seat === null || self === undefined) {
      return null;
    }
    if (state.phase !== GamePhase.RobberDiscard) {
      return null;
    }
    if (!state.pendingRobberDiscardSeats.includes(seat)) {
      return null;
    }
    const total = this.totalResources(self.resources);
    return { required: Math.floor(total / 2), handCounts: self.resources };
  });
  public readonly tradePartners = computed<readonly TradePartner[]>(() => {
    const payload = this.rawLobbyState();
    if (payload === undefined) {
      return [];
    }
    return payload.players
      .filter((player) => !player.isSelf)
      .map((player) => ({ seat: player.seat, name: player.displayName }));
  });
  public readonly pendingTrade = computed<TradeOfferDto | null>(() => {
    const trade = this.gameState.tradeUpdated.value();
    return trade === undefined ? null : trade.trade;
  });

  public readonly lobbyUiStep = LobbyUiStep;
  public readonly uiFeedbackTone = UiFeedbackTone;

  private readonly phaseSync = effect(() => {
    const state = this.lobbyUiState();
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
      this.setFeedback(UiFeedbackTone.Success, 'Spiel gestartet.');
    }
  });

  public startSession(): void {
    if (this.sessionForm.invalid) {
      this.sessionForm.markAllAsTouched();
      this.setFeedback(UiFeedbackTone.Error, 'Bitte gib einen Namen mit mindestens 2 Zeichen ein.');
      return;
    }
    void this.runStartSession();
  }

  public joinLobby(): void {
    if (this.lobbyForm.invalid) {
      this.lobbyForm.markAllAsTouched();
      this.setFeedback(UiFeedbackTone.Error, 'Bitte gib eine gueltige Lobby-ID ein.');
      return;
    }
    void this.runJoinLobby();
  }

  public backToSignIn(): void {
    this.joinInProgress.set(false);
    this.spectatorCamService.reset();
    this.uiStep.set(LobbyUiStep.SignIn);
    this.setFeedback(UiFeedbackTone.Info, 'Bitte gib deinen Namen ein.');
  }

  public backToJoinLobby(): void {
    this.gameState.disconnectLobby();
    this.joinInProgress.set(false);
    this.spectatorCamService.reset();
    this.uiStep.set(LobbyUiStep.JoinLobby);
    this.setFeedback(UiFeedbackTone.Info, 'Waehle eine Lobby-ID und tritt erneut bei.');
  }

  public resetSession(): void {
    this.gameState.disconnectLobby();
    this.playerSession.clear();
    this.sessionState.set(null);
    this.joinInProgress.set(false);
    this.feedback.set(null);
    this.spectatorCamService.reset();
    this.uiStep.set(LobbyUiStep.SignIn);
  }

  public clearFeedback(): void {
    this.feedback.set(null);
  }

  public startLobby(): void {
    this.gameState.startLobby();
  }

  public rollDice(): void {
    // Reached from the menu button (already gated) and from a 3D die click —
    // guard so a die click outside the roll phase is a no-op.
    if (!this.canRollDice()) {
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

  // === Build flow ===

  /** A figure in the player's own arsenal was clicked — enter build mode if allowed. */
  public onArsenalBuild(kind: BuildKind): void {
    if (kind === BuildKind.Settlement && this.canBuildSettlement()) {
      this.enterBuildMode(BuildKind.Settlement);
    } else if (kind === BuildKind.Road && this.canBuildRoad()) {
      this.enterBuildMode(BuildKind.Road);
    } else if (kind === BuildKind.City && this.canBuildCity()) {
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
        // First of the two free roads — keep build mode for the second pick.
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

  // === Robber flow ===

  public onRobberTilePicked(pick: RobberTilePick): void {
    this.pendingRobberCoord.set({ q: pick.q, r: pick.r });
    const payload = this.rawLobbyState();
    const selfSeat = this.selfSeat();
    let candidates: RobberVictimCandidate[] = [];
    if (payload !== undefined && selfSeat !== null) {
      const victimSeats = collectRobberVictimSeats(
        payload.tiles,
        payload.settlements.map((s) => ({ seat: s.seat, vertexId: s.vertexId })),
        payload.players.map((p) => ({
          seat: p.seat,
          totalResourceCards: this.totalResources(p.resources),
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

  // === Trade flow ===

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

  // === Dev card flow ===

  public onDevCardClicked(): void {
    if (this.canPlayDevCard()) {
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

  // === Discard flow ===

  public onSubmitDiscard(discard: Readonly<Record<ResourceType, number>>): void {
    this.gameState.submitRobberDiscard(discard);
  }

  private async runStartSession(): Promise<void> {
    const normalizedDisplayName = this.sessionForm.controls.displayName.value.trim();
    if (normalizedDisplayName.length < 2) {
      this.setFeedback(UiFeedbackTone.Error, 'Bitte gib einen Namen mit mindestens 2 Zeichen ein.');
      return;
    }
    await this.playerSession.ensureReady();
    const sid = this.playerSession.sessionId();
    if (sid.length === 0) {
      this.setFeedback(UiFeedbackTone.Error, 'Session konnte nicht gestartet werden.');
      return;
    }
    this.sessionState.set({ displayName: normalizedDisplayName, sessionId: sid });
    this.uiStep.set(LobbyUiStep.JoinLobby);
    this.setFeedback(UiFeedbackTone.Success, `Willkommen ${normalizedDisplayName}. Session ist aktiv.`);
  }

  private async runJoinLobby(): Promise<void> {
    const session = this.sessionState();
    if (session === null) {
      this.setFeedback(UiFeedbackTone.Error, 'Session nicht vorhanden. Bitte erneut anmelden.');
      this.uiStep.set(LobbyUiStep.SignIn);
      return;
    }
    const normalizedLobbyId = this.lobbyForm.controls.lobbyId.value.trim();
    if (normalizedLobbyId.length < 2) {
      this.setFeedback(UiFeedbackTone.Error, 'Bitte gib eine gueltige Lobby-ID ein.');
      return;
    }
    this.joinInProgress.set(true);
    this.setFeedback(UiFeedbackTone.Info, `Verbinde mit Lobby "${normalizedLobbyId}" ...`);
    try {
      await this.gameState.connectToLobby(normalizedLobbyId, session.displayName);
      this.uiStep.set(LobbyUiStep.Lobby);
      this.joinInProgress.set(false);
      this.setFeedback(UiFeedbackTone.Success, `Lobby "${normalizedLobbyId}" erfolgreich beigetreten.`);
    } catch {
      this.joinInProgress.set(false);
      this.setFeedback(
        UiFeedbackTone.Error,
        `Verbindung zur Lobby "${normalizedLobbyId}" ist fehlgeschlagen.`,
      );
    }
  }

  private setFeedback(tone: UiFeedbackTone, message: string): void {
    this.feedback.set({ tone, message });
  }

  private totalResources(resources: Readonly<Record<ResourceType, number>>): number {
    let total = 0;
    const keys = Object.values(ResourceType);
    for (let i = 0; i < keys.length; i += 1) {
      total += resources[keys[i]] ?? 0;
    }
    return total;
  }

  private mapLobbyState(payload: LobbyFullStatePayload): LobbyUiState {
    const seats: LobbySeatUiState[] = [];
    const seatOrder: PlayerSeat[] = [
      PlayerSeat.North,
      PlayerSeat.East,
      PlayerSeat.South,
      PlayerSeat.West,
    ];
    for (let index = 0; index < seatOrder.length; index += 1) {
      const seat = seatOrder[index];
      const matchingPlayer = payload.players.find((candidate) => candidate.seat === seat);
      const playerName = matchingPlayer?.displayName ?? 'Wartet auf Spieler';
      seats.push({
        seat,
        seatLabel: this.seatLabel(seat),
        playerName,
        isConnected: matchingPlayer?.isConnected ?? false,
        isSelf: matchingPlayer?.isSelf ?? false,
      });
    }
    return {
      lobbyId: payload.lobbyId,
      phase: payload.phase,
      activeSeat: payload.currentSeat,
      adminSeat: payload.adminSeat,
      pendingRobberDiscardSeats: payload.pendingRobberDiscardSeats,
      pendingSetupRoadSeat: payload.pendingSetupRoadSeat,
      pendingSetupRoadFromVertexId: payload.pendingSetupRoadFromVertexId,
      vertexIds: payload.vertexIds,
      edgeIds: payload.edgeIds,
      longestRoadSeat: payload.longestRoadSeat,
      largestArmySeat: payload.largestArmySeat,
      winnerSeat: payload.winnerSeat,
      seats,
    };
  }

  public seatLabel(seat: PlayerSeat): string {
    const seatLabels: Record<PlayerSeat, string> = {
      [PlayerSeat.North]: 'Nord',
      [PlayerSeat.East]: 'Ost',
      [PlayerSeat.South]: 'Sued',
      [PlayerSeat.West]: 'West',
    };
    return seatLabels[seat];
  }

  public lobbyIdValue(): string {
    return this.lobbyForm.controls.lobbyId.value;
  }

  private phaseToLabel(phase: GamePhase): string {
    const phaseLabels: Record<GamePhase, string> = {
      [GamePhase.LobbyWaiting]: 'Lobby',
      [GamePhase.SetupForward]: 'Aufbau 1',
      [GamePhase.SetupBackward]: 'Aufbau 2',
      [GamePhase.Rolling]: 'Wuerfeln',
      [GamePhase.RobberDiscard]: 'Raeuber: Abwerfen',
      [GamePhase.RobberMove]: 'Raeuber versetzen',
      [GamePhase.Trading]: 'Handel',
      [GamePhase.Building]: 'Bauen',
      [GamePhase.EndTurn]: 'Rundenende',
      [GamePhase.Finished]: 'Spielende',
    };
    return phaseLabels[phase];
  }
}
