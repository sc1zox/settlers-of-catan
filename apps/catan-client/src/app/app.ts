import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SessionShell } from './features/session-shell/session-shell';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SessionShell],
  templateUrl: './app.html',
})
export class App {}
