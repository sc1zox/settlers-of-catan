import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  signal,
} from '@angular/core';
import { GameEngine } from '../../game/engine';
import { HoverState } from '../../game/interaction/hover';
import { CardTooltipComponent, CardTooltipModel } from './card-tooltip';
import { DiceOverlayComponent, DiceOverlayModel } from './dice-overlay';
import { HarborTooltipComponent, HarborTooltipModel } from './harbor-tooltip';

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
  private engine: GameEngine | null = null;
  private diceNonce = 0;

  readonly harborTooltip = signal<HarborTooltipModel | null>(null);
  readonly cardTooltip = signal<CardTooltipModel | null>(null);
  readonly diceOverlay = signal<DiceOverlayModel | null>(null);
  readonly cardFocused = signal<boolean>(false);

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
    this.engine.start();
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
    if (state?.target.kind === 'harbor') {
      this.harborTooltip.set({
        harbor: state.target.harbor.info,
        x: state.screenX,
        y: state.screenY,
      });
      this.cardTooltip.set(null);
      return;
    }
    if (state?.target.kind === 'card') {
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
