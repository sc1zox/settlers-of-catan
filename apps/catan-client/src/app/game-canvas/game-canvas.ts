import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
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
import { BuildKind, DevCardType, SceneObjectKind } from '@catan/api-interfaces';
import { GameEngine } from '../../game/engine';
import { DEV_KIND_TO_CARD_TYPE } from '../../game/engine-runtime/constants';
import { DevKind } from '../../game/cards/textures';
import { setGameTranslateFn } from '../../game/i18n-bridge';
import { DevCardsService } from '../features/dev-cards/dev-cards.service';
import { GameStateResource } from '../core/game/game-state.resource';
import { GameSettingsService } from '../features/game-settings/game-settings.service';
import { HeadVideoSyncService } from '../features/webcam-head/head-video-sync.service';
import { SpectatorCameraService } from '../features/spectator-camera/spectator-camera.service';
import { TradeFinalizeAnimationService } from '../features/trading/trade-finalize-animation.service';
import { mapLobbyFullStateToSceneState } from '../../shared/game-scene/map-lobby-full-state-to-scene';
import type { LobbySceneState } from '../../shared/game-scene/lobby-scene-state';
import { HoverState } from '../../game/interaction/hover';
import { BuildConfirmModel } from './build-confirm-popover';
import { CardTooltip, CardTooltipModel } from './card-tooltip';
import { DiceOverlay, DiceOverlayModel } from './dice-overlay';
import { HarborTooltip, HarborTooltipModel } from './harbor-tooltip';

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
  imports: [TranslatePipe, DiceOverlay, HarborTooltip, CardTooltip],
  templateUrl: './game-canvas.html',
  styleUrl: './game-canvas.scss',
  host: {
    class: 'game-canvas-host',
    '[class.card-focus-active]': 'cardFocused()',
  },
})
export class GameCanvas implements AfterViewInit, OnDestroy {
  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  private readonly gameState = inject(GameStateResource);
  private readonly devCards = inject(DevCardsService);
  private readonly gameSettings = inject(GameSettingsService);
  private readonly headVideoSync = inject(HeadVideoSyncService);
  private readonly spectatorCam = inject(SpectatorCameraService);
  private readonly translate = inject(TranslateService);
  private readonly tradeFinalizeAnimation = inject(TradeFinalizeAnimationService);
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
  readonly playDevCard = output<DevCardType>();
  readonly rollDiceRequested = output<void>();

  readonly harborTooltip = signal<HarborTooltipModel | null>(null);
  readonly cardTooltip = signal<CardTooltipModel | null>(null);
  readonly diceOverlay = signal<DiceOverlayModel | null>(null);
  readonly cardFocused = signal<boolean>(false);
  readonly focusedDevCardType = signal<DevCardType | null>(null);
  readonly focusedDevCardSlotIndex = signal<number | null>(null);
  protected readonly devCardTypeEnum = DevCardType;

  protected readonly canShowPlayFocusedDevCard = computed<boolean>(() => {
    const type = this.focusedDevCardType();
    const slotIndex = this.focusedDevCardSlotIndex();
    if (type === null || type === DevCardType.VictoryPoint || slotIndex === null) {
      return false;
    }
    return this.devCards.canPlayFocusedDevCardAt(slotIndex);
  });

  private readonly currentSceneState = computed<LobbySceneState | null>(() => {
    const state = this.gameState.lobby.value();
    return state !== undefined ? mapLobbyFullStateToSceneState(state) : null;
  });

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
    const scene = this.currentSceneState();
    if (!this.engine) {
      return;
    }
    if (scene === null) {
      if (this.gameState.connection() === undefined) {
        this.engine.clearLobbySceneOverlay();
      }
      return;
    }
    this.engine.applySceneState(scene);
    const state = this.gameState.lobby.value();
    const lastRoll = state?.lastDiceRoll ?? null;
    this.engine.setRolledNumberChipHighlight(lastRoll !== null ? lastRoll.sum : null);
    this.headVideoSync.syncToEngine(this.engine, scene);
  });

  private readonly headVideoSyncEffect = effect(() => {
    this.headVideoSync.readSyncTriggers();
    const scene = this.currentSceneState();
    if (!this.engine || scene === null) {
      return;
    }
    this.headVideoSync.syncToEngine(this.engine, scene);
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

  private readonly renderPixelRatioSync = effect(() => {
    const ratio = this.gameSettings.renderPixelRatio();
    this.engine?.setRenderPixelRatio(ratio);
  });

  private readonly cloudDensitySync = effect(() => {
    const density = this.gameSettings.cloudDensity();
    this.engine?.setCloudDensity(density);
  });

  private readonly sunShaftsSync = effect(() => {
    const enabled = this.gameSettings.sunShaftsEnabled();
    this.engine?.setSunShaftsEnabled(enabled);
  });

  private readonly waterAnimationSync = effect(() => {
    const enabled = this.gameSettings.waterAnimationEnabled();
    this.engine?.setWaterAnimationEnabled(enabled);
  });

  private readonly ambientAnimationsSync = effect(() => {
    const enabled = this.gameSettings.ambientAnimationsEnabled();
    this.engine?.setAmbientAnimationsEnabled(enabled);
  });

  private readonly headVideoGammaSync = effect(() => {
    if (!this.engine) {
      return;
    }
    this.headVideoSync.applyDisplayGammaToEngine(this.engine);
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

  private readonly bonusAwardSync = effect(() => {
    const award = this.gameState.bonusAwarded.value();
    if (award && this.engine) {
      this.engine.playBonusAward(award.kind, award.recipientSeat);
    }
  });

  private readonly tradeSwapSync = effect(() => {
    const request = this.tradeFinalizeAnimation.swapRequest();
    if (request === null || !this.engine) {
      return;
    }
    this.engine.playTradeSwap(
      request.fromSeat,
      request.recipientSeat,
      request.give,
      request.take,
    );
    this.tradeFinalizeAnimation.consumePendingSwap();
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
      const devKind: DevKind | null = focused ? (this.engine?.focusedDevKind() ?? null) : null;
      this.focusedDevCardType.set(devKind === null ? null : DEV_KIND_TO_CARD_TYPE[devKind]);
      this.focusedDevCardSlotIndex.set(
        focused ? (this.engine?.focusedDevCardSlotIndex() ?? null) : null,
      );
    });
    this.engine.setArsenalBuildHandler((kind) => this.arsenalBuild.emit(kind));
    this.engine.setBuildSpotPickHandler((kind, id, x, y) => {
      this.buildSpotPicked.emit({ kind, id, x, y });
    });
    this.engine.setRobberTilePickHandler((q, r, x, y) => {
      this.robberTilePicked.emit({ q, r, x, y });
    });
    this.engine.setBuildModeCancelHandler(() => this.buildModeCancelled.emit());
    this.engine.setDiceRollRequestHandler(() => this.rollDiceRequested.emit());
    this.engine.start();
    const scene = this.currentSceneState();
    if (scene !== null) {
      this.engine.applySceneState(scene);
      this.headVideoSync.syncToEngine(this.engine, scene);
    }
    this.seedEngineSettings(this.engine);
  }

  private seedEngineSettings(engine: GameEngine): void {
    engine.setShadowQuality(this.gameSettings.shadowQuality());
    engine.setSceneBrightness(this.gameSettings.sceneBrightness());
    engine.setRenderPixelRatio(this.gameSettings.renderPixelRatio());
    engine.setCloudDensity(this.gameSettings.cloudDensity());
    engine.setSunShaftsEnabled(this.gameSettings.sunShaftsEnabled());
    engine.setWaterAnimationEnabled(this.gameSettings.waterAnimationEnabled());
    engine.setAmbientAnimationsEnabled(this.gameSettings.ambientAnimationsEnabled());
    engine.showBuildSpots(this.buildMode(), this.freeRoadMode());
    engine.setRobberMode(this.robberMode());
    engine.setSpectatorCameraMode(this.spectatorCam.mode());
    engine.setDiceRollClickEnabled(this.diceRollClickEnabled());
    this.headVideoSync.applyDisplayGammaToEngine(engine);
    if (this.gameSettings.performanceSamplingEnabled()) {
      engine.setPerformanceStatsHandler((stats) => {
        this.gameSettings.handlePerformanceStats(stats);
      });
    }
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
    this.focusedDevCardType.set(null);
    this.focusedDevCardSlotIndex.set(null);
  }

  public confirmPlayFocusedDevCard(): void {
    const type = this.focusedDevCardType();
    if (type === null || type === DevCardType.VictoryPoint) {
      return;
    }
    // Clear focus first — otherwise the full-screen card-backdrop swallows the
    // next click (the tile pick for Knight, the edge pick for RoadBuilding).
    this.engine?.clearFocusedCard();
    this.focusedDevCardType.set(null);
    this.focusedDevCardSlotIndex.set(null);
    this.playDevCard.emit(type);
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
