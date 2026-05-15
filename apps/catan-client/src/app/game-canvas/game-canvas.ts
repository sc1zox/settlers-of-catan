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
import { AvatarKind, BuildKind, SceneObjectKind } from '@catan/api-interfaces';
import { GameEngine, PerformanceSnapshot } from '../../game/engine';
import { setGameTranslateFn } from '../../game/i18n-bridge';
import { GameStateResource } from '../core/game/game-state.resource';
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
    @if (performanceStats(); as stats) {
      <section class="perf-dock">
        @if (performancePanelOpen()) {
          <aside id="perf-panel" class="perf-panel" aria-label="Performance">
            <div class="perf-row"><span>FPS</span><strong>{{ formatNumber(stats.fps, 1) }}</strong></div>
            <div class="perf-row">
              <span>Frame</span><strong>{{ formatNumber(stats.frameMs, 2) }} ms</strong>
            </div>
            <div class="perf-row"><span>Draw Calls</span><strong>{{ stats.drawCalls }}</strong></div>
            <div class="perf-row"><span>Triangles</span><strong>{{ stats.triangles }}</strong></div>
            <div class="perf-row"><span>Geometries</span><strong>{{ stats.geometries }}</strong></div>
            <div class="perf-row"><span>Textures</span><strong>{{ stats.textures }}</strong></div>
            <div class="perf-row">
              <span>Tiles</span><strong>{{ stats.visibleTiles }}/{{ stats.totalTiles }}</strong>
            </div>
            <div class="perf-row">
              <span>Harbors</span><strong>{{ stats.visibleHarbors }}/{{ stats.totalHarbors }}</strong>
            </div>
            <div class="perf-row">
              <span>Players</span><strong>{{ stats.visiblePlayers }}/{{ stats.totalPlayers }}</strong>
            </div>
            <div class="perf-row">
              <span>Board Overlay</span><strong>{{ stats.boardOverlayVisible ? 'on' : 'off' }}</strong>
            </div>
            <div class="perf-row">
              <span>Dice</span><strong>{{ stats.diceVisible ? 'on' : 'off' }}</strong>
            </div>
          </aside>
        }
        <button
          class="perf-toggle"
          type="button"
          [attr.aria-expanded]="performancePanelOpen()"
          aria-controls="perf-panel"
          (click)="togglePerformancePanel()"
        >
          {{ performancePanelOpen() ? 'Performance ausblenden' : 'Performance anzeigen' }}
        </button>
      </section>
    }
  `,
  styleUrl: './game-canvas.scss',
})
export class GameCanvasComponent implements AfterViewInit, OnDestroy {
    @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  private readonly gameState = inject(GameStateResource);
  private readonly spectatorCam = inject(SpectatorCameraService);
  private readonly translate = inject(TranslateService);
  private engine: GameEngine | null = null;
  private diceNonce = 0;

  /** Active build kind (drives the ghost figures); `null` leaves build mode. */
  readonly buildMode = input<BuildKind | null>(null);
  /** Switches road ghosts to the cost-free road-building dev-card list. */
  readonly freeRoadMode = input<boolean>(false);
  /** Activates robber placement (tile clicks report their coordinate). */
  readonly robberMode = input<boolean>(false);
  /** When true, 3D die clicks request a roll (must match server-side legality). */
  readonly diceRollClickEnabled = input<boolean>(false);
  /** When true, DOM overlays tied to the match HUD are suppressed (e.g. free camera). */
  readonly uiChromeHidden = input<boolean>(false);
  /** Preferred avatar for the local human player. */
  readonly selectedAvatar = input<AvatarKind>(AvatarKind.Scout);

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
  readonly performanceStats = signal<PerformanceSnapshot | null>(null);
  readonly performancePanelOpen = signal<boolean>(false);

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

  // Pushes every lobby-state update into the Three.js scene. Registered in the
  // injection context; the engine may not exist on the first run (before
  // ngAfterViewInit) so the guard skips until it does.
  private readonly lobbyStateSync = effect(() => {
    const state = this.gameState.lobby.value();
    if (state && this.engine) {
      this.engine.applyLobbyState(state);
    }
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

  private readonly selectedAvatarSync = effect(() => {
    this.engine?.setPreferredSelfAvatar(this.selectedAvatar());
  });

  private readonly uiChromeClear = effect(() => {
    if (!this.uiChromeHidden()) {
      return;
    }
    this.harborTooltip.set(null);
    this.cardTooltip.set(null);
    this.diceOverlay.set(null);
  });

  // The server roll is authoritative — drive the dice-tray animation with its
  // values so the menu roll button and a die click both tumble the 3D dice.
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
    this.engine.setPerformanceStatsHandler((stats) => this.performanceStats.set(stats));
    this.engine.start();
    // Catch state / mode that arrived before the engine existed.
    const current = this.gameState.lobby.value();
    if (current) {
      this.engine.applyLobbyState(current);
    }
    this.engine.showBuildSpots(this.buildMode(), this.freeRoadMode());
    this.engine.setRobberMode(this.robberMode());
    this.engine.setSpectatorCameraMode(this.spectatorCam.mode());
    this.engine.setDiceRollClickEnabled(this.diceRollClickEnabled());
    this.engine.setPreferredSelfAvatar(this.selectedAvatar());
  }

  public ngOnDestroy(): void {
    setGameTranslateFn(null);
    this.engine?.dispose();
    this.engine = null;
    this.performanceStats.set(null);
  }

  public dismissDice(): void {
    this.diceOverlay.set(null);
  }

  public dismissFocusedCard(): void {
    this.engine?.clearFocusedCard();
  }

  public togglePerformancePanel(): void {
    this.performancePanelOpen.update((open) => !open);
  }

  public formatNumber(value: number, digits: number): string {
    return value.toFixed(digits);
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
