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
import { BuildKind, SceneObjectKind } from '@catan/api-interfaces';
import { GameEngine } from '../../game/engine';
import { GameStateResource } from '../game/game-state.resource';
import { SpectatorCameraService } from '../features/spectator-camera';
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
  imports: [DiceOverlayComponent, HarborTooltipComponent, CardTooltipComponent],
  template: `
    <div #host class="game-host"></div>
    <app-harbor-tooltip [model]="harborTooltip()" />
    <app-card-tooltip [model]="cardTooltip()" />
    @if (cardFocused()) {
      <button
        class="card-backdrop"
        type="button"
        aria-label="Karte schließen"
        (click)="dismissFocusedCard()"
      ></button>
    }
    <app-dice-overlay [model]="diceOverlay()" (dismiss)="dismissDice()" />
  `,
  styleUrl: './game-canvas.scss',
})
export class GameCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  private readonly gameState = inject(GameStateResource);
  private readonly spectatorCam = inject(SpectatorCameraService);
  private engine: GameEngine | null = null;
  private diceNonce = 0;

  /** Active build kind (drives the ghost figures); `null` leaves build mode. */
  readonly buildMode = input<BuildKind | null>(null);
  /** Switches road ghosts to the cost-free road-building dev-card list. */
  readonly freeRoadMode = input<boolean>(false);
  /** Activates robber placement (tile clicks report their coordinate). */
  readonly robberMode = input<boolean>(false);

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

  // The server roll is authoritative — drive the dice-tray animation with its
  // values so the menu roll button and a die click both tumble the 3D dice.
  private readonly diceRollSync = effect(() => {
    const rolled = this.gameState.diceRolled.value();
    if (rolled && this.engine) {
      this.engine.rollDiceTo(rolled.roll.a, rolled.roll.b);
    }
  });

  public ngAfterViewInit(): void {
    this.engine = new GameEngine(this.hostRef.nativeElement);
    this.engine.setHoverHandler((state) => this.handleHover(state));
    this.engine.setDiceResultHandler((result) => {
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
    this.engine.start();
    // Catch state / mode that arrived before the engine existed.
    const current = this.gameState.lobby.value();
    if (current) {
      this.engine.applyLobbyState(current);
    }
    this.engine.showBuildSpots(this.buildMode(), this.freeRoadMode());
    this.engine.setRobberMode(this.robberMode());
    this.engine.setSpectatorCameraMode(this.spectatorCam.mode());
  }

  public ngOnDestroy(): void {
    this.engine?.dispose();
    this.engine = null;
  }

  public dismissDice(): void {
    this.diceOverlay.set(null);
  }

  public dismissFocusedCard(): void {
    this.engine?.clearFocusedCard();
  }

  private handleHover(state: HoverState | null): void {
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
