import { ChangeDetectionStrategy, Component } from '@angular/core';
import { GameCanvasComponent } from './game-canvas/game-canvas';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GameCanvasComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
