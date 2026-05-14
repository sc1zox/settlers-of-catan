import { Injectable, inject } from '@angular/core';
import { PlayerSessionService } from '../session/player-session.service';

@Injectable({ providedIn: 'root' })
export class AppInitService {
  private readonly playerSession = inject(PlayerSessionService);

  public initialize(): Promise<void> {
    return this.bootstrapPlayerSession();
  }

  private async bootstrapPlayerSession(): Promise<void> {
    try {
      await this.playerSession.ensureReady();
    } catch {
      return;
    }
  }
}
