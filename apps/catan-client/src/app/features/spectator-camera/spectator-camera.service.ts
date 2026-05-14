import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SpectatorCameraService {
  private readonly modeSignal = signal<boolean>(false);

  public readonly mode = this.modeSignal.asReadonly();

  public toggle(): void {
    this.modeSignal.update((active) => !active);
  }

  public reset(): void {
    this.modeSignal.set(false);
  }
}
