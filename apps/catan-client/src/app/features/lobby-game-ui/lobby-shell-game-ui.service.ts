import { computed, DestroyRef, effect, inject, Injectable, signal, Signal } from '@angular/core';
import {
  GamePhase,
  LobbyFullStatePayload,
  LobbyPlayerPublicDto,
  PlayerSeat,
  TradeOfferDto,
} from '@catan/api-interfaces';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslateService } from '@ngx-translate/core';
import { TranslateInstantFn } from '../../../shared/i18n/translate-instant-fn';
import { EnumTranslate } from '../../../game/i18n/enum-translate.helper';
import { GameStateResource } from '../../core/game/game-state.resource';
import { DiscardModalModel } from '../../game-canvas/discard-modal';
import { TradePartner } from '../../game-canvas/trade-panel';
import { LobbyUiState, LobbyUiStep } from '../../shared/types/lobby-ui-state';
import {
  computeHudChromeSpectatorPaused,
  computeHudGameplayLocked,
  computeHudRobberDiscardSelf,
  computeHudShowPassiveWait,
} from '../../shared/helper/lobby-game-ui/in-game-hud-state';
import {
  mapLobbyFullStateToUiState,
  phaseLabel,
  seatLabel,
} from '../../shared/helper/lobby-game-ui/lobby-ui.mapper';
import { totalResourceCards } from '../../shared/helper/lobby-game-ui/resource-card-totals';
import { buildTurnAnnouncerText } from '../../shared/helper/lobby-game-ui/turn-announcer-text';

@Injectable({ providedIn: 'root' })
export class LobbyShellGameUiService {
  private readonly gameState = inject(GameStateResource);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly uiStepHolder = signal<Signal<LobbyUiStep> | null>(null);

  private readonly instant: TranslateInstantFn = (key, params) =>
    this.translate.instant(marker(key), params);

  public attachUiStep(uiStep: Signal<LobbyUiStep>): void {
    this.uiStepHolder.set(uiStep);
  }

  private readonly uiStep = computed<LobbyUiStep>(() => {
    const holder = this.uiStepHolder();
    return holder === null ? LobbyUiStep.SignIn : holder();
  });

  public readonly lobbyUiState = computed<LobbyUiState | null>(() => {
    const lobbyState = this.gameState.lobby.value();
    if (lobbyState === undefined) {
      return null;
    }
    return mapLobbyFullStateToUiState(lobbyState, this.instant);
  });

  public readonly rawLobbyState = computed<LobbyFullStatePayload | undefined>(() =>
    this.gameState.lobby.value(),
  );

  public readonly isLobbyLoading = computed<boolean>(() => this.gameState.lobby.isLoading());

  public readonly activeSeatLabel = computed<string>(() => {
    const state = this.lobbyUiState();
    return state === null ? '-' : seatLabel(state.activeSeat, this.instant);
  });

  public readonly phaseLabel = computed<string>(() => {
    const state = this.lobbyUiState();
    return state === null ? '-' : phaseLabel(state.phase, this.instant);
  });

  public readonly longestRoadLabel = computed<string>(() => {
    const state = this.lobbyUiState();
    if (state === null || state.longestRoadSeat === null) {
      return '-';
    }
    return seatLabel(state.longestRoadSeat, this.instant);
  });

  public readonly largestArmyLabel = computed<string>(() => {
    const state = this.lobbyUiState();
    if (state === null || state.largestArmySeat === null) {
      return '-';
    }
    return seatLabel(state.largestArmySeat, this.instant);
  });

  public readonly winnerLabel = computed<string>(() => {
    const state = this.lobbyUiState();
    if (state === null || state.winnerSeat === null) {
      return '-';
    }
    return seatLabel(state.winnerSeat, this.instant);
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

  public readonly selfPlayer = computed<LobbyPlayerPublicDto | undefined>(() => {
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

  public readonly activeTurnPlayerName = computed<string>(() => {
    const raw = this.rawLobbyState();
    const ui = this.lobbyUiState();
    if (raw === undefined || ui === null) {
      return '';
    }
    const player = raw.players.find((p) => p.seat === ui.activeSeat);
    return player?.displayName ?? EnumTranslate.translateGenericPlayer(this.instant);
  });

  public readonly announcerText = computed<string>(() =>
    buildTurnAnnouncerText(
      {
        uiStep: this.uiStep(),
        raw: this.rawLobbyState(),
        ui: this.lobbyUiState(),
        activeTurnPlayerName: this.activeTurnPlayerName(),
        isSelfActiveTurn: this.isSelfTurn(),
      },
      this.instant,
    ),
  );

  public readonly announcerEntry = signal<{ id: number; text: string }>({ id: 0, text: '' });
  private announcerHideHandle: ReturnType<typeof setTimeout> | null = null;

  public readonly hudGameplayLocked = computed<boolean>(() =>
    computeHudGameplayLocked(this.lobbyUiState(), this.isSelfTurn()),
  );

  public readonly hudRobberDiscardSelf = computed<boolean>(() =>
    computeHudRobberDiscardSelf(this.lobbyUiState(), this.selfSeat()),
  );

  public readonly hudShowPassiveWait = computed<boolean>(() =>
    computeHudShowPassiveWait(
      this.hudGameplayLocked(),
      this.hudRobberDiscardSelf(),
      this.lobbyUiState()?.phase,
    ),
  );

  public readonly hudChromeSpectatorPaused = computed<boolean>(() =>
    computeHudChromeSpectatorPaused(this.hudGameplayLocked(), this.hudRobberDiscardSelf()),
  );

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
    () => this.isSelfTurn() && this.lobbyUiState()?.phase === GamePhase.Trading,
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
    const total = totalResourceCards(self.resources);
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

  public constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.announcerHideHandle !== null) {
        clearTimeout(this.announcerHideHandle);
        this.announcerHideHandle = null;
      }
    });
    effect(() => {
      const text = this.announcerText();
      if (text.length === 0) {
        if (this.announcerHideHandle !== null) {
          clearTimeout(this.announcerHideHandle);
          this.announcerHideHandle = null;
        }
        this.announcerEntry.set({ id: 0, text: '' });
        return;
      }
      const prev = this.announcerEntry();
      if (prev.text === text) {
        return;
      }
      if (this.announcerHideHandle !== null) {
        clearTimeout(this.announcerHideHandle);
        this.announcerHideHandle = null;
      }
      this.announcerEntry.set({ id: prev.id + 1, text });
      this.announcerHideHandle = setTimeout(() => {
        this.announcerHideHandle = null;
        this.announcerEntry.set({ id: 0, text: '' });
      }, 6000);
    });
  }
}
