import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslateService } from '@ngx-translate/core';
import { TranslateInstantFn } from '../../../shared/i18n/translate-instant-fn';
import { buildTurnAnnouncerText } from './turn-announcer-text';
import {
  computeHudChromeSpectatorPaused,
  computeHudGameplayLocked,
  computeHudRobberDiscardSelf,
  computeHudShowPassiveWait,
} from './in-game-hud-state';
import { LobbyGameUiStateService } from './lobby-game-ui-state.service';

@Injectable({ providedIn: 'root' })
export class LobbyHudUiService {
  private readonly state = inject(LobbyGameUiStateService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly instant: TranslateInstantFn = (key, params) =>
    this.translate.instant(marker(key), params);

  public readonly announcerText = computed<string>(() =>
    buildTurnAnnouncerText(
      {
        uiStep: this.state.uiStep(),
        raw: this.state.rawLobbyState(),
        ui: this.state.lobbyUiState(),
        activeTurnPlayerName: this.state.activeTurnPlayerName(),
        isSelfActiveTurn: this.state.isSelfTurn(),
      },
      this.instant,
    ),
  );

  public readonly announcerEntry = signal<{ id: number; text: string }>({ id: 0, text: '' });
  private announcerHideHandle: ReturnType<typeof setTimeout> | null = null;

  public readonly hudGameplayLocked = computed<boolean>(() =>
    computeHudGameplayLocked(this.state.lobbyUiState(), this.state.isSelfTurn()),
  );

  public readonly hudRobberDiscardSelf = computed<boolean>(() =>
    computeHudRobberDiscardSelf(this.state.lobbyUiState(), this.state.selfSeat()),
  );

  public readonly hudShowPassiveWait = computed<boolean>(() =>
    computeHudShowPassiveWait(
      this.hudGameplayLocked(),
      this.hudRobberDiscardSelf(),
      this.state.lobbyUiState()?.phase,
    ),
  );

  public readonly hudChromeSpectatorPaused = computed<boolean>(() =>
    computeHudChromeSpectatorPaused(this.hudGameplayLocked(), this.hudRobberDiscardSelf()),
  );

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
