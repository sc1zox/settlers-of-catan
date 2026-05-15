import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BuildKind,
  SceneObjectKind,
  WEBCAM_MEDIA_SCOPE,
  WebcamMediaScopeKey,
  type LobbyFullStatePayload,
} from '@catan/api-interfaces';
import { GameEngine } from '../../game/engine';
import { setGameTranslateFn } from '../../game/i18n-bridge';
import { GameStateResource } from '../core/game/game-state.resource';
import { GameSettingsService } from '../features/game-settings/game-settings.service';
import { LobbyLiveKitService } from '../features/webcam-head/lobby-livekit.service';
import { SpectatorCameraService } from '../features/spectator-camera/spectator-camera.service';
import { HoverState } from '../../game/interaction/hover';
import { BuildConfirmModel } from './build-confirm-popover';
import { CardTooltipComponent, CardTooltipModel } from './card-tooltip';
import { DiceOverlayComponent, DiceOverlayModel } from './dice-overlay';
import { HarborTooltipComponent, HarborTooltipModel } from './harbor-tooltip';

export interface RobberTilePick {
  readonly q: number;
  readonly r: number;
  readonly x: number;
  readonly y: number;
}

@Component({
  selector: 'app-game-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, DiceOverlayComponent, HarborTooltipComponent, CardTooltipComponent],
  template: `
    <div #host class="game-host"></div>
    @if (!uiChromeHidden()) {
      <app-harbor-tooltip [model]="harborTooltip()" />
      <app-card-tooltip [model]="cardTooltip()" />
    }
    @if (cardFocused() && !uiChromeHidden()) {
      <button
        class="card-backdrop"
        type="button"
        [attr.aria-label]="'gameCanvas.closeCardAria' | translate"
        (click)="dismissFocusedCard()"
      ></button>
    }
    @if (!uiChromeHidden()) {
      <app-dice-overlay [model]="diceOverlay()" (dismiss)="dismissDice()" />
    }
  `,
  styleUrl: './game-canvas.scss',
})
export class GameCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  private readonly gameState = inject(GameStateResource);
  private readonly gameSettings = inject(GameSettingsService);
  private readonly liveKit = inject(LobbyLiveKitService);
  private readonly spectatorCam = inject(SpectatorCameraService);
  private readonly translate = inject(TranslateService);
  private engine: GameEngine | null = null;
  private diceNonce = 0;

  readonly buildMode = input<BuildKind | null>(null);
  readonly freeRoadMode = input<boolean>(false);
  readonly robberMode = input<boolean>(false);
  readonly diceRollClickEnabled = input<boolean>(false);
  readonly uiChromeHidden = input<boolean>(false);

  readonly arsenalBuild = output<BuildKind>();
  readonly buildSpotPicked = output<BuildConfirmModel>();
  readonly robberTilePicked = output<RobberTilePick>();
  readonly buildModeCancelled = output<void>();
  readonly devCardClicked = output<void>();
  readonly rollDiceRequested = output<void>();

  readonly harborTooltip = signal<HarborTooltipModel | null>(null);
  readonly cardTooltip = signal<CardTooltipModel | null>(null);
  readonly diceOverlay = signal<DiceOverlayModel | null>(null);
  readonly cardFocused = signal<boolean>(false);

  private readonly diceOverlayAutoDismiss = effect((onCleanup) => {
    const overlay = this.diceOverlay();
    if (overlay === null) {
      return;
    }
    const handle = window.setTimeout(() => {
      this.diceOverlay.set(null);
    }, 3000);
    onCleanup(() => {
      window.clearTimeout(handle);
    });
  });

  private readonly lobbyStateSync = effect(() => {
    const state = this.gameState.lobby.value();
    if (state && this.engine) {
      this.engine.applyLobbyState(state);
      this.syncHeadVideos(state);
    }
  });

  private readonly headVideoSync = effect(() => {
    this.liveKit.localVideoElement();
    this.liveKit.remoteVideoRevision();
    const state = this.gameState.lobby.value();
    if (!this.engine || state === undefined) {
      return;
    }
    this.syncHeadVideos(state);
  });

  private readonly buildModeSync = effect(() => {
    const mode = this.buildMode();
    const freeRoad = this.freeRoadMode();
    this.engine?.showBuildSpots(mode, freeRoad);
  });

  private readonly robberModeSync = effect(() => {
    const active = this.robberMode();
    this.engine?.setRobberMode(active);
  });

  private readonly spectatorCamSync = effect(() => {
    const active = this.spectatorCam.mode();
    this.engine?.setSpectatorCameraMode(active);
  });

  private readonly diceRollClickGate = effect(() => {
    this.engine?.setDiceRollClickEnabled(this.diceRollClickEnabled());
  });

  private readonly shadowQualitySync = effect(() => {
    const quality = this.gameSettings.shadowQuality();
    this.engine?.setShadowQuality(quality);
  });

  private readonly sceneBrightnessSync = effect(() => {
    const brightness = this.gameSettings.sceneBrightness();
    this.engine?.setSceneBrightness(brightness);
  });

  private readonly headVideoGammaSync = effect(() => {
    const gamma = WEBCAM_MEDIA_SCOPE[WebcamMediaScopeKey.HeadDisplayGamma];
    this.engine?.setHeadVideoDisplayGamma(gamma);
  });

  private readonly performanceSamplingSync = effect(() => {
    const enabled = this.gameSettings.performanceSamplingEnabled();
    if (!this.engine) {
      return;
    }
    if (enabled) {
      this.engine.setPerformanceStatsHandler((stats) => {
        this.gameSettings.handlePerformanceStats(stats);
      });
      return;
    }
    this.engine.setPerformanceStatsHandler(null);
  });

  private readonly uiChromeClear = effect(() => {
    if (!this.uiChromeHidden()) {
      return;
    }
    this.harborTooltip.set(null);
    this.cardTooltip.set(null);
    this.diceOverlay.set(null);
  });

  private readonly diceRollSync = effect(() => {
    const rolled = this.gameState.diceRolled.value();
    if (rolled && this.engine) {
      this.engine.rollDiceTo(rolled.roll.a, rolled.roll.b);
    }
  });

  public ngAfterViewInit(): void {
    setGameTranslateFn((key, params) => this.translate.instant(marker(key), params));
    this.engine = new GameEngine(this.hostRef.nativeElement);
    this.engine.setHoverHandler((state) => this.handleHover(state));
    this.engine.setDiceResultHandler((result) => {
      if (this.uiChromeHidden()) {
        return;
      }
      this.diceNonce += 1;
      this.diceOverlay.set({ result, nonce: this.diceNonce });
    });
    this.engine.setFocusChangeHandler((focused) => {
      this.cardFocused.set(focused);
    });
    this.engine.setArsenalBuildHandler((kind) => this.arsenalBuild.emit(kind));
    this.engine.setBuildSpotPickHandler((kind, id, x, y) => {
      this.buildSpotPicked.emit({ kind, id, x, y });
    });
    this.engine.setRobberTilePickHandler((q, r, x, y) => {
      this.robberTilePicked.emit({ q, r, x, y });
    });
    this.engine.setBuildModeCancelHandler(() => this.buildModeCancelled.emit());
    this.engine.setDevCardClickHandler(() => this.devCardClicked.emit());
    this.engine.setDiceRollRequestHandler(() => this.rollDiceRequested.emit());
    this.engine.setShadowQuality(this.gameSettings.shadowQuality());
    this.engine.setSceneBrightness(this.gameSettings.sceneBrightness());
    this.engine.setHeadVideoDisplayGamma(WEBCAM_MEDIA_SCOPE[WebcamMediaScopeKey.HeadDisplayGamma]);
    if (this.gameSettings.performanceSamplingEnabled()) {
      this.engine.setPerformanceStatsHandler((stats) => {
        this.gameSettings.handlePerformanceStats(stats);
      });
    }
    this.engine.start();
    const current = this.gameState.lobby.value();
    if (current) {
      this.engine.applyLobbyState(current);
      this.syncHeadVideos(current);
    }
    this.engine.showBuildSpots(this.buildMode(), this.freeRoadMode());
    this.engine.setRobberMode(this.robberMode());
    this.engine.setSpectatorCameraMode(this.spectatorCam.mode());
    this.engine.setDiceRollClickEnabled(this.diceRollClickEnabled());
  }

  public ngOnDestroy(): void {
    setGameTranslateFn(null);
    this.engine?.dispose();
    this.engine = null;
  }

  public dismissDice(): void {
    this.diceOverlay.set(null);
  }

  public dismissFocusedCard(): void {
    this.engine?.clearFocusedCard();
  }

  private syncHeadVideos(state: LobbyFullStatePayload): void {
    if (!this.engine) {
      return;
    }
    for (let i = 0; i < state.players.length; i += 1) {
      const player = state.players[i];
      if (player.isBot) {
        this.engine.setHeadVideoForSeat(player.seat, null);
        continue;
      }
      if (player.isSelf) {
        this.engine.setHeadVideoForSeat(player.seat, this.liveKit.localVideoElement());
        continue;
      }
      this.engine.setHeadVideoForSeat(player.seat, this.liveKit.getRemoteVideoForSeat(player.seat));
    }
  }

  private handleHover(state: HoverState | null): void {
    if (this.uiChromeHidden()) {
      return;
    }
    if (state?.target.kind === SceneObjectKind.Harbor) {
      this.harborTooltip.set({
        harbor: state.target.harbor.info,
        x: state.screenX,
        y: state.screenY,
      });
      this.cardTooltip.set(null);
      return;
    }
    if (state?.target.kind === SceneObjectKind.Card) {
      this.harborTooltip.set(null);
      this.cardTooltip.set({
        title: state.target.tooltip.title,
        detail: state.target.tooltip.detail,
        x: state.screenX,
        y: state.screenY,
      });
      return;
    }
    this.harborTooltip.set(null);
    this.cardTooltip.set(null);
  }
}
