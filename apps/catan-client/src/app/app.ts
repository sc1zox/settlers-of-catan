import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SessionShell } from './features/session-shell/session-shell';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SessionShell],
  template: `<app-session-shell />`,
})
export class App {}
