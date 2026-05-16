import { inject, Injectable } from '@angular/core';
import { WEBCAM_MEDIA_SCOPE, WebcamMediaScopeKey } from '@catan/api-interfaces';
import { GameEngine } from '../../../game/engine';
import { GameSettingsService } from '../game-settings/game-settings.service';
import { LobbyLiveKitService } from './lobby-livekit.service';
import type { LobbySceneState } from '../../shared/helper/game-scene/lobby-scene-state';

@Injectable({ providedIn: 'root' })
export class HeadVideoSyncService {
  private readonly liveKit = inject(LobbyLiveKitService);
  private readonly gameSettings = inject(GameSettingsService);

  public readSyncTriggers(): void {
    this.liveKit.localVideoElement();
    this.liveKit.remoteVideoRevision();
    this.gameSettings.webcamEnabled();
  }

  public applyDisplayGammaToEngine(engine: GameEngine): void {
    const gamma = WEBCAM_MEDIA_SCOPE[WebcamMediaScopeKey.HeadDisplayGamma];
    engine.setHeadVideoDisplayGamma(gamma);
  }

  public syncToEngine(engine: GameEngine, scene: LobbySceneState): void {
    for (let i = 0; i < scene.players.length; i += 1) {
      const player = scene.players[i];
      if (player.isBot) {
        engine.setHeadVideoForSeat(player.seat, null, false);
        continue;
      }
      if (player.isSelf) {
        const localVideo = this.liveKit.localVideoElement();
        const showPlaceholder = this.gameSettings.webcamEnabled() && localVideo === null;
        engine.setHeadVideoForSeat(player.seat, localVideo, showPlaceholder);
        continue;
      }
      const remoteVideo = this.liveKit.getRemoteVideoForSeat(player.seat);
      const remotePlaceholder = remoteVideo === null;
      engine.setHeadVideoForSeat(player.seat, remoteVideo, remotePlaceholder);
    }
  }
}
