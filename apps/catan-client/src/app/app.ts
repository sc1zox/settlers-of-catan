import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { GameCanvasComponent } from './game-canvas/game-canvas';
import { GameStateResource } from './game/game-state.resource';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GameCanvasComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly gameState = inject(GameStateResource);

  constructor() {
    this.gameState.connectToLobby('demo', 'Spieler');
  }
}
