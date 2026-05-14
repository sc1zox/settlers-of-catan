import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { GameCanvasComponent } from './game-canvas/game-canvas';
import { GameSocketService } from './game-socket.service';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GameCanvasComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly gameSocket = inject(GameSocketService);

  constructor() {
    this.gameSocket.connect();
    this.gameSocket.joinSession('demo');
  }
}
