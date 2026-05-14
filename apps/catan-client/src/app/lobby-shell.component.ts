import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  DefaultDisplayName,
  GamePhase,
  KnownLobbyId,
  LobbyFullStatePayload,
  PlayerSeat,
  ResourceType,
} from '@catan/api-interfaces';
import { GameCanvasComponent } from './game-canvas/game-canvas';
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

@Component({
  selector: 'app-lobby-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GameCanvasComponent, ReactiveFormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class LobbyShellComponent {
  private readonly fb = inject(FormBuilder);
  private readonly gameState = inject(GameStateResource);
  private readonly playerSession = inject(PlayerSessionService);

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
  public readonly settlementForm = this.fb.nonNullable.group({
    vertexId: ['', [Validators.required]],
  });
  public readonly roadForm = this.fb.nonNullable.group({
    edgeId: ['', [Validators.required]],
  });
  public readonly cityForm = this.fb.nonNullable.group({
    vertexId: ['', [Validators.required]],
  });
  public readonly roadBuildingForm = this.fb.nonNullable.group({
    firstEdgeId: ['', [Validators.required]],
    secondEdgeId: '',
  });
  public readonly robberMoveForm = this.fb.nonNullable.group({
    q: '0',
    r: '0',
    victimSeat: '',
  });
  public readonly monopolyForm = this.fb.nonNullable.group({
    resource: ResourceType.Wheat,
  });
  public readonly plentyForm = this.fb.nonNullable.group({
    first: ResourceType.Wood,
    second: ResourceType.Brick,
  });
  public readonly bankTradeForm = this.fb.nonNullable.group({
    giveResource: ResourceType.Wood,
    giveAmount: ['4', [Validators.required]],
    receiveResource: ResourceType.Brick,
  });
  public readonly discardForm = this.fb.nonNullable.group({
    wood: '0',
    brick: '0',
    wheat: '0',
    wool: '0',
    ore: '0',
  });
  public readonly tradeProposeForm = this.fb.nonNullable.group({
    toSeat: String(PlayerSeat.East),
    offerWood: '0',
    offerBrick: '0',
    offerWheat: '0',
    offerWool: '0',
    offerOre: '0',
    requestWood: '0',
    requestBrick: '0',
    requestWheat: '0',
    requestWool: '0',
    requestOre: '0',
  });
  public readonly tradeRespondForm = this.fb.nonNullable.group({
    tradeId: ['', [Validators.required]],
  });

  public readonly lobbyUiState = computed<LobbyUiState | null>(() => {
    const lobbyState = this.gameState.lobby.value();
    if (lobbyState === undefined) {
      return null;
    }
    return this.mapLobbyState(lobbyState);
  });

  public readonly isLobbyLoading = computed<boolean>(() => this.gameState.lobby.isLoading());
  public readonly isJoinInProgress = computed<boolean>(() => this.joinInProgress());
  public readonly activeSeatLabel = computed<string>(() => {
    const state = this.lobbyUiState();
    if (state === null) {
      return '-';
    }
    return this.seatLabel(state.activeSeat);
  });
  public readonly phaseLabel = computed<string>(() => {
    const state = this.lobbyUiState();
    if (state === null) {
      return '-';
    }
    return this.phaseToLabel(state.phase);
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
      const seat = state.seats[i];
      if (seat.isSelf) {
        return seat.seat;
      }
    }
    return null;
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
      const seat = state.seats[i];
      if (seat.isSelf) {
        return seat.seat === state.adminSeat;
      }
    }
    return false;
  });
  public readonly canStartLobby = computed<boolean>(() => {
    const state = this.lobbyUiState();
    if (state === null) {
      return false;
    }
    return this.isLobbyAdmin() && state.phase === GamePhase.LobbyWaiting;
  });
  public readonly canRollDice = computed<boolean>(() => {
    const state = this.lobbyUiState();
    if (state === null) {
      return false;
    }
    return this.isSelfTurn() && state.phase === GamePhase.Rolling;
  });
  public readonly canFinishTrading = computed<boolean>(() => {
    const state = this.lobbyUiState();
    if (state === null) {
      return false;
    }
    return this.isSelfTurn() && state.phase === GamePhase.Trading;
  });
  public readonly canEndTurn = computed<boolean>(() => {
    const state = this.lobbyUiState();
    if (state === null) {
      return false;
    }
    return this.isSelfTurn() && state.phase === GamePhase.Building;
  });
  public readonly canBuildSettlement = computed<boolean>(() => {
    const state = this.lobbyUiState();
    if (state === null) {
      return false;
    }
    const seat = this.selfSeat();
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
  public readonly setupPendingRoadVertexId = computed<string | null>(() => {
    const state = this.lobbyUiState();
    const seat = this.selfSeat();
    if (state === null || seat === null) {
      return null;
    }
    if (state.pendingSetupRoadSeat !== seat) {
      return null;
    }
    return state.pendingSetupRoadFromVertexId;
  });
  public readonly availableRoadEdgeIds = computed<readonly string[]>(() => {
    const state = this.lobbyUiState();
    if (state === null) {
      return [];
    }
    const pendingVertexId = this.setupPendingRoadVertexId();
    if (pendingVertexId === null) {
      return state.edgeIds;
    }
    const filtered: string[] = [];
    for (let i = 0; i < state.edgeIds.length; i += 1) {
      const edgeId = state.edgeIds[i];
      if (this.edgeTouchesVertex(edgeId, pendingVertexId)) {
        filtered.push(edgeId);
      }
    }
    return filtered;
  });
  public readonly canBuildRoad = computed<boolean>(() => {
    const state = this.lobbyUiState();
    if (state === null) {
      return false;
    }
    if (!this.isSelfTurn()) {
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
  public readonly canSubmitRobberDiscard = computed<boolean>(() => {
    const state = this.lobbyUiState();
    const seat = this.selfSeat();
    if (state === null || seat === null) {
      return false;
    }
    if (state.phase !== GamePhase.RobberDiscard) {
      return false;
    }
    return state.pendingRobberDiscardSeats.includes(seat);
  });
  public readonly canMoveRobber = computed<boolean>(() => {
    const state = this.lobbyUiState();
    if (state === null) {
      return false;
    }
    return this.isSelfTurn() && state.phase === GamePhase.RobberMove;
  });
  public readonly canProposeTrade = computed<boolean>(() => this.canFinishTrading());
  public readonly canBuildCity = computed<boolean>(() => this.canEndTurn());
  public readonly canBuyDevCard = computed<boolean>(() => this.canEndTurn());
  public readonly canPlayDevCard = computed<boolean>(() => {
    const state = this.lobbyUiState();
    if (state === null) {
      return false;
    }
    return this.isSelfTurn() && (state.phase === GamePhase.Trading || state.phase === GamePhase.Building);
  });
  public readonly canBankTrade = computed<boolean>(() => this.canFinishTrading());
  public readonly canRespondTrade = computed<boolean>(() => {
    const state = this.lobbyUiState();
    if (state === null) {
      return false;
    }
    return state.phase === GamePhase.Trading;
  });
  public readonly lastTradeStatus = computed<string>(() => {
    const trade = this.gameState.tradeUpdated.value();
    if (trade === undefined) {
      return '-';
    }
    return trade.trade.status;
  });
  public readonly lastTradeId = computed<string>(() => {
    const trade = this.gameState.tradeUpdated.value();
    if (trade === undefined) {
      return '';
    }
    return trade.trade.id;
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
  private readonly tradeSync = effect(() => {
    const trade = this.gameState.tradeUpdated.value();
    if (trade === undefined) {
      return;
    }
    this.tradeRespondForm.controls.tradeId.setValue(trade.trade.id);
  });
  private readonly topologySync = effect(() => {
    const state = this.lobbyUiState();
    if (state === null) {
      return;
    }
    if (this.settlementForm.controls.vertexId.value.length === 0 && state.vertexIds.length > 0) {
      this.settlementForm.controls.vertexId.setValue(state.vertexIds[0]);
    }
    if (this.roadForm.controls.edgeId.value.length === 0 && state.edgeIds.length > 0) {
      this.roadForm.controls.edgeId.setValue(state.edgeIds[0]);
    }
    if (this.cityForm.controls.vertexId.value.length === 0 && state.vertexIds.length > 0) {
      this.cityForm.controls.vertexId.setValue(state.vertexIds[0]);
    }
    if (
      this.roadBuildingForm.controls.firstEdgeId.value.length === 0 &&
      state.edgeIds.length > 0
    ) {
      this.roadBuildingForm.controls.firstEdgeId.setValue(state.edgeIds[0]);
    }
    const allowedRoadEdgeIds = this.availableRoadEdgeIds();
    if (allowedRoadEdgeIds.length > 0) {
      if (!allowedRoadEdgeIds.includes(this.roadForm.controls.edgeId.value)) {
        this.roadForm.controls.edgeId.setValue(allowedRoadEdgeIds[0]);
      }
    } else if (this.roadForm.controls.edgeId.value.length > 0) {
      this.roadForm.controls.edgeId.setValue('');
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
    this.uiStep.set(LobbyUiStep.SignIn);
    this.setFeedback(UiFeedbackTone.Info, 'Bitte gib deinen Namen ein.');
  }

  public backToJoinLobby(): void {
    this.gameState.disconnectLobby();
    this.joinInProgress.set(false);
    this.uiStep.set(LobbyUiStep.JoinLobby);
    this.setFeedback(UiFeedbackTone.Info, 'Waehle eine Lobby-ID und tritt erneut bei.');
  }

  public resetSession(): void {
    this.gameState.disconnectLobby();
    this.playerSession.clear();
    this.sessionState.set(null);
    this.joinInProgress.set(false);
    this.feedback.set(null);
    this.uiStep.set(LobbyUiStep.SignIn);
  }

  public clearFeedback(): void {
    this.feedback.set(null);
  }

  public cancelAllIngameActions(): void {
    this.cancelSettlementAction();
    this.cancelRoadAction();
    this.cancelCityAction();
    this.cancelDevCardActions();
    this.cancelBankTradeAction();
    this.cancelDiscardAction();
    this.cancelRobberAction();
    this.cancelTradeProposeAction();
    this.cancelTradeRespondAction();
    this.clearFeedback();
  }

  public startLobby(): void {
    this.gameState.startLobby();
  }

  public rollDice(): void {
    this.gameState.rollDice();
  }

  public finishTrading(): void {
    this.gameState.finishTrading();
  }

  public endTurn(): void {
    this.gameState.endTurn();
  }

  public buildSettlement(): void {
    if (this.settlementForm.invalid) {
      this.settlementForm.markAllAsTouched();
      this.setFeedback(UiFeedbackTone.Error, 'Bitte waehle eine gueltige Vertex-ID.');
      return;
    }
    const vertexId = this.settlementForm.controls.vertexId.value.trim();
    if (vertexId.length === 0) {
      return;
    }
    this.gameState.buildSettlement(vertexId);
  }

  public cancelSettlementAction(): void {
    this.settlementForm.markAsPristine();
    this.settlementForm.markAsUntouched();
    const state = this.lobbyUiState();
    if (state !== null && state.vertexIds.length > 0) {
      this.settlementForm.controls.vertexId.setValue(state.vertexIds[0]);
      return;
    }
    this.settlementForm.controls.vertexId.setValue('');
  }

  public buildRoad(): void {
    if (this.roadForm.invalid) {
      this.roadForm.markAllAsTouched();
      this.setFeedback(UiFeedbackTone.Error, 'Bitte waehle eine gueltige Edge-ID.');
      return;
    }
    const edgeId = this.roadForm.controls.edgeId.value.trim();
    if (edgeId.length === 0) {
      return;
    }
    this.gameState.buildRoad(edgeId);
  }

  public cancelRoadAction(): void {
    this.roadForm.markAsPristine();
    this.roadForm.markAsUntouched();
    const roadOptions = this.availableRoadEdgeIds();
    if (roadOptions.length > 0) {
      this.roadForm.controls.edgeId.setValue(roadOptions[0]);
      return;
    }
    this.roadForm.controls.edgeId.setValue('');
  }

  public buildCity(): void {
    if (this.cityForm.invalid) {
      this.cityForm.markAllAsTouched();
      this.setFeedback(UiFeedbackTone.Error, 'Bitte waehle eine gueltige Vertex-ID.');
      return;
    }
    const vertexId = this.cityForm.controls.vertexId.value.trim();
    if (vertexId.length === 0) {
      return;
    }
    this.gameState.buildCity(vertexId);
  }

  public cancelCityAction(): void {
    this.cityForm.markAsPristine();
    this.cityForm.markAsUntouched();
    const state = this.lobbyUiState();
    if (state !== null && state.vertexIds.length > 0) {
      this.cityForm.controls.vertexId.setValue(state.vertexIds[0]);
      return;
    }
    this.cityForm.controls.vertexId.setValue('');
  }

  public buyDevCard(): void {
    this.gameState.buyDevCard();
  }

  public cancelDevCardActions(): void {
    this.monopolyForm.reset({ resource: ResourceType.Wheat });
    this.plentyForm.reset({ first: ResourceType.Wood, second: ResourceType.Brick });
    const state = this.lobbyUiState();
    const defaultEdge = state !== null && state.edgeIds.length > 0 ? state.edgeIds[0] : '';
    this.roadBuildingForm.reset({
      firstEdgeId: defaultEdge,
      secondEdgeId: '',
    });
    this.robberMoveForm.reset({ q: '0', r: '0', victimSeat: '' });
  }

  public submitRobberDiscard(): void {
    if (!this.isValidResourceInputs('discard')) {
      this.setFeedback(UiFeedbackTone.Error, 'Raeuber-Abwurf muss aus gueltigen Ganzzahlen bestehen.');
      return;
    }
    this.gameState.submitRobberDiscard(this.readResourceMap('discard'));
  }

  public cancelDiscardAction(): void {
    this.discardForm.reset({
      wood: '0',
      brick: '0',
      wheat: '0',
      wool: '0',
      ore: '0',
    });
  }

  public moveRobber(): void {
    if (!this.isValidIntegerInput(this.robberMoveForm.controls.q.value) || !this.isValidIntegerInput(this.robberMoveForm.controls.r.value)) {
      this.setFeedback(UiFeedbackTone.Error, 'Raeuber-Koordinaten muessen Ganzzahlen sein.');
      return;
    }
    const q = this.parseIntOrZero(this.robberMoveForm.controls.q.value);
    const r = this.parseIntOrZero(this.robberMoveForm.controls.r.value);
    const victimSeat = this.parseOptionalSeat(this.robberMoveForm.controls.victimSeat.value);
    this.gameState.moveRobber(q, r, victimSeat);
  }

  public cancelRobberAction(): void {
    this.robberMoveForm.reset({ q: '0', r: '0', victimSeat: '' });
  }

  public playKnight(): void {
    if (!this.isValidIntegerInput(this.robberMoveForm.controls.q.value) || !this.isValidIntegerInput(this.robberMoveForm.controls.r.value)) {
      this.setFeedback(UiFeedbackTone.Error, 'Ritter braucht gueltige Raeuber-Koordinaten.');
      return;
    }
    const q = this.parseIntOrZero(this.robberMoveForm.controls.q.value);
    const r = this.parseIntOrZero(this.robberMoveForm.controls.r.value);
    const victimSeat = this.parseOptionalSeat(this.robberMoveForm.controls.victimSeat.value);
    this.gameState.playKnight(q, r, victimSeat);
  }

  public playMonopoly(): void {
    this.gameState.playMonopoly(this.monopolyForm.controls.resource.value);
  }

  public playYearOfPlenty(): void {
    this.gameState.playYearOfPlenty(
      this.plentyForm.controls.first.value,
      this.plentyForm.controls.second.value,
    );
  }

  public playRoadBuilding(): void {
    if (this.roadBuildingForm.controls.firstEdgeId.invalid) {
      this.roadBuildingForm.controls.firstEdgeId.markAsTouched();
      this.setFeedback(UiFeedbackTone.Error, 'Bitte waehle mindestens eine gueltige Edge-ID.');
      return;
    }
    const first = this.roadBuildingForm.controls.firstEdgeId.value.trim();
    if (first.length === 0) {
      return;
    }
    const secondRaw = this.roadBuildingForm.controls.secondEdgeId.value.trim();
    const second = secondRaw.length > 0 ? secondRaw : undefined;
    this.gameState.playRoadBuilding(first, second);
  }

  public bankTrade(): void {
    if (!this.isValidPositiveIntegerInput(this.bankTradeForm.controls.giveAmount.value)) {
      this.bankTradeForm.controls.giveAmount.markAsTouched();
      this.setFeedback(UiFeedbackTone.Error, 'Bankhandel braucht eine positive Ganzzahl als Menge.');
      return;
    }
    const giveAmount = this.parseIntOrZero(this.bankTradeForm.controls.giveAmount.value);
    this.gameState.bankTrade(
      this.bankTradeForm.controls.giveResource.value,
      giveAmount,
      this.bankTradeForm.controls.receiveResource.value,
    );
  }

  public cancelBankTradeAction(): void {
    this.bankTradeForm.reset({
      giveResource: ResourceType.Wood,
      giveAmount: '4',
      receiveResource: ResourceType.Brick,
    });
  }

  public proposeTrade(): void {
    if (!this.isValidResourceInputs('offer') || !this.isValidResourceInputs('request')) {
      this.setFeedback(UiFeedbackTone.Error, 'Handelswerte muessen gueltige nicht-negative Ganzzahlen sein.');
      return;
    }
    const toSeat = this.parseSeatOrDefault(this.tradeProposeForm.controls.toSeat.value, PlayerSeat.East);
    this.gameState.proposeTrade(toSeat, this.readResourceMap('offer'), this.readResourceMap('request'));
  }

  public cancelTradeProposeAction(): void {
    this.tradeProposeForm.reset({
      toSeat: String(PlayerSeat.East),
      offerWood: '0',
      offerBrick: '0',
      offerWheat: '0',
      offerWool: '0',
      offerOre: '0',
      requestWood: '0',
      requestBrick: '0',
      requestWheat: '0',
      requestWool: '0',
      requestOre: '0',
    });
  }

  public acceptTrade(): void {
    if (this.tradeRespondForm.invalid) {
      this.tradeRespondForm.markAllAsTouched();
      this.setFeedback(UiFeedbackTone.Error, 'Bitte gib eine gueltige tradeId ein.');
      return;
    }
    const tradeId = this.tradeRespondForm.controls.tradeId.value.trim();
    if (tradeId.length === 0) {
      return;
    }
    this.gameState.acceptTrade(tradeId);
  }

  public rejectTrade(): void {
    if (this.tradeRespondForm.invalid) {
      this.tradeRespondForm.markAllAsTouched();
      this.setFeedback(UiFeedbackTone.Error, 'Bitte gib eine gueltige tradeId ein.');
      return;
    }
    const tradeId = this.tradeRespondForm.controls.tradeId.value.trim();
    if (tradeId.length === 0) {
      return;
    }
    this.gameState.rejectTrade(tradeId);
  }

  public cancelTradeRespondAction(): void {
    this.tradeRespondForm.reset({ tradeId: '' });
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
    };
    return phaseLabels[phase];
  }

  private parseIntOrZero(value: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    return Math.trunc(parsed);
  }

  private isValidIntegerInput(value: string): boolean {
    return /^-?\d+$/.test(value.trim());
  }

  private isValidPositiveIntegerInput(value: string): boolean {
    return /^[1-9]\d*$/.test(value.trim());
  }

  private parseSeatOrDefault(value: string, fallback: PlayerSeat): PlayerSeat {
    const parsed = Number(value);
    if (
      parsed === PlayerSeat.North ||
      parsed === PlayerSeat.East ||
      parsed === PlayerSeat.South ||
      parsed === PlayerSeat.West
    ) {
      return parsed;
    }
    return fallback;
  }

  private parseOptionalSeat(value: string): PlayerSeat | undefined {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return undefined;
    }
    return this.parseSeatOrDefault(trimmed, PlayerSeat.North);
  }

  private edgeTouchesVertex(edgeId: string, vertexId: string): boolean {
    const separatorIndex = edgeId.indexOf('|');
    if (separatorIndex <= 0 || separatorIndex >= edgeId.length - 1) {
      return false;
    }
    const firstVertexId = edgeId.slice(0, separatorIndex);
    const secondVertexId = edgeId.slice(separatorIndex + 1);
    return firstVertexId === vertexId || secondVertexId === vertexId;
  }

  private readResourceMap(kind: 'offer' | 'request' | 'discard'): Readonly<Partial<Record<ResourceType, number>>> {
    const wood = this.readResourceInput(kind, ResourceType.Wood);
    const brick = this.readResourceInput(kind, ResourceType.Brick);
    const wheat = this.readResourceInput(kind, ResourceType.Wheat);
    const wool = this.readResourceInput(kind, ResourceType.Wool);
    const ore = this.readResourceInput(kind, ResourceType.Ore);
    return {
      [ResourceType.Wood]: wood,
      [ResourceType.Brick]: brick,
      [ResourceType.Wheat]: wheat,
      [ResourceType.Wool]: wool,
      [ResourceType.Ore]: ore,
    };
  }

  private readResourceInput(kind: 'offer' | 'request' | 'discard', resource: ResourceType): number {
    let raw = '0';
    if (kind === 'offer') {
      raw = this.readOfferResource(resource);
    } else if (kind === 'request') {
      raw = this.readRequestResource(resource);
    } else {
      raw = this.readDiscardResource(resource);
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return Math.trunc(parsed);
  }

  private isValidResourceInputs(kind: 'offer' | 'request' | 'discard'): boolean {
    const keys = Object.values(ResourceType);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const raw = this.readResourceRaw(kind, key);
      if (!/^\d+$/.test(raw.trim())) {
        return false;
      }
    }
    return true;
  }

  private readResourceRaw(kind: 'offer' | 'request' | 'discard', resource: ResourceType): string {
    if (kind === 'offer') {
      return this.readOfferResource(resource);
    }
    if (kind === 'request') {
      return this.readRequestResource(resource);
    }
    return this.readDiscardResource(resource);
  }

  private readOfferResource(resource: ResourceType): string {
    if (resource === ResourceType.Wood) {
      return this.tradeProposeForm.controls.offerWood.value;
    }
    if (resource === ResourceType.Brick) {
      return this.tradeProposeForm.controls.offerBrick.value;
    }
    if (resource === ResourceType.Wheat) {
      return this.tradeProposeForm.controls.offerWheat.value;
    }
    if (resource === ResourceType.Wool) {
      return this.tradeProposeForm.controls.offerWool.value;
    }
    return this.tradeProposeForm.controls.offerOre.value;
  }

  private readRequestResource(resource: ResourceType): string {
    if (resource === ResourceType.Wood) {
      return this.tradeProposeForm.controls.requestWood.value;
    }
    if (resource === ResourceType.Brick) {
      return this.tradeProposeForm.controls.requestBrick.value;
    }
    if (resource === ResourceType.Wheat) {
      return this.tradeProposeForm.controls.requestWheat.value;
    }
    if (resource === ResourceType.Wool) {
      return this.tradeProposeForm.controls.requestWool.value;
    }
    return this.tradeProposeForm.controls.requestOre.value;
  }

  private readDiscardResource(resource: ResourceType): string {
    if (resource === ResourceType.Wood) {
      return this.discardForm.controls.wood.value;
    }
    if (resource === ResourceType.Brick) {
      return this.discardForm.controls.brick.value;
    }
    if (resource === ResourceType.Wheat) {
      return this.discardForm.controls.wheat.value;
    }
    if (resource === ResourceType.Wool) {
      return this.discardForm.controls.wool.value;
    }
    return this.discardForm.controls.ore.value;
  }
}
