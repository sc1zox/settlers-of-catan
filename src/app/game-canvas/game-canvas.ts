import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { GameEngine } from '../../game/engine';
import { HoverState } from '../../game/interaction/hover';
import { HarborTooltipComponent, HarborTooltipModel } from './harbor-tooltip';

@Component({
  selector: 'app-game-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HarborTooltipComponent],
  template: `
    <div #host class="game-host"></div>
    <app-harbor-tooltip [model]="harborTooltip()" />
  `,
  styleUrl: './game-canvas.scss',
})
export class GameCanvasComponent implements AfterViewInit, OnDestroy {
  private readonly ngZone = inject(NgZone);
  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  private engine: GameEngine | null = null;

  readonly harborTooltip = signal<HarborTooltipModel | null>(null);

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this.engine = new GameEngine(this.hostRef.nativeElement);
      this.engine.setHoverHandler((state) => this.handleHover(state));
      this.engine.start();
    });
  }

  ngOnDestroy(): void {
    this.engine?.dispose();
    this.engine = null;
  }

  private handleHover(state: HoverState | null): void {
    // Bring updates back into Angular's zone so OnPush change detection runs.
    this.ngZone.run(() => {
      if (state?.target.kind === 'harbor') {
        this.harborTooltip.set({
          harbor: state.target.harbor.info,
          x: state.screenX,
          y: state.screenY,
        });
      } else {
        this.harborTooltip.set(null);
      }
    });
  }
}
