import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { SpectatorCameraService } from './spectator-camera.service';

@Component({
  selector: 'app-spectator-camera-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <button
        type="button"
        class="spectator-cam-toggle"
        [class.spectator-cam-toggle--active]="camera.mode()"
        [attr.aria-pressed]="camera.mode()"
        [attr.title]="
          camera.mode()
            ? 'Freie Kamera aus (Spielklicks wieder aktiv)'
            : 'Freie Kamera: Tisch mit der Maus drehen und zoomen, keine Spielaktionen per Klick'
        "
        (click)="camera.toggle()"
        aria-label="Freie Kamera umschalten"
      >
        <svg class="spectator-cam-toggle__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"
          />
        </svg>
      </button>
    }
  `,
  styleUrl: './spectator-camera-toggle.component.scss',
})
export class SpectatorCameraToggleComponent {
  protected readonly camera = inject(SpectatorCameraService);
  readonly visible = input<boolean>(true);
}
