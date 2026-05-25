import { computed, inject, Injectable } from '@angular/core';
import { GamePhase, LobbyFullStatePayload, LobbyPlayerPublicDto, PlayerSeat } from '@catan/api-interfaces';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslateService } from '@ngx-translate/core';
import { TranslateInstantFn } from '../../../shared/i18n/translate-instant-fn';
import { EnumTranslate } from '../../../game/i18n/enum-translate.helper';
import { GameStateResource } from '../../core/game/game-state.resource';
import { LobbyUiState, LobbyUiStep } from './lobby-ui-state';
import {
  displayNameForSeat,
  mapLobbyFullStateToUiState,
  phaseLabel,
  seatLabel,
} from './lobby-ui.mapper';

@Injectable({ providedIn: 'root' })
export class LobbyGameUiStateService {
  private readonly gameState = inject(GameStateResource);
  private readonly translate = inject(TranslateService);

  private readonly instant: TranslateInstantFn = (key, params) =>
    this.translate.instant(marker(key), params);

  public readonly uiStep = computed<LobbyUiStep>(() => {
    const lobbyState = this.gameState.lobby.value();
    if (lobbyState === undefined) {
      return LobbyUiStep.SignIn;
    }
    if (lobbyState.phase === GamePhase.LobbyWaiting) {
      return LobbyUiStep.Lobby;
    }
    return LobbyUiStep.InGame;
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

  public readonly phaseLabel = computed<string>(() => {
    const state = this.lobbyUiState();
    return state === null ? '-' : phaseLabel(state.phase, this.instant);
  });

  public readonly gameFinishedBannerText = computed<string | null>(() => {
    const ui = this.lobbyUiState();
    const raw = this.rawLobbyState();
    if (ui === null || raw === undefined) {
      return null;
    }
    if (ui.phase !== GamePhase.Finished) {
      return null;
    }
    if (raw.winnerSeat !== null) {
      const winnerName = displayNameForSeat(raw, raw.winnerSeat, this.instant);
      return this.instant(marker('announcer.finishedWithWinner'), { winnerName });
    }
    return this.instant(marker('announcer.finished'));
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
}
