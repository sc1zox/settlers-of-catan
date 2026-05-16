import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { LiveKitCredentialsPayload, PlayerSeat } from '@catan/api-interfaces';
import {
  ConnectionState,
  LocalParticipant,
  LocalVideoTrack,
  RemoteParticipant,
  RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  createLocalVideoTrack,
} from 'livekit-client';
import type { VideoCaptureOptions } from 'livekit-client';
import { GameSettingsService } from '../game-settings/game-settings.service';
import { isLikelyMobileWebcamHost } from '../../shared/helper/webcam/mobile-webcam-host';
import { webcamQualityPreset } from '../../shared/helper/webcam/webcam-quality-preset';

interface LiveKitParticipantMetadata {
  readonly seat?: PlayerSeat;
}

const POST_CONNECT_PUBLISH_DELAY_MS = 120;
const CAMERA_PUBLISH_TIMEOUT_MS = 15_000;
const LIVEKIT_PEER_CONNECT_TIMEOUT_MS = 120_000;

@Injectable({ providedIn: 'root' })
export class LobbyLiveKitService implements OnDestroy {
  private readonly gameSettings = inject(GameSettingsService);
  private room: Room | null = null;
  private connectGeneration = 0;
  private primedLocalVideo: Promise<LocalVideoTrack | null> | null = null;
  private readonly remoteVideos = new Map<PlayerSeat, HTMLVideoElement>();

  public readonly localVideoElement = signal<HTMLVideoElement | null>(null);
  public readonly remoteVideoRevision = signal<number>(0);

  public ngOnDestroy(): void {
    void this.abandonPrimedLocalVideoCapture();
    void this.disconnect();
  }

  public beginLocalVideoCaptureFromUserGesture(): void {
    if (!this.gameSettings.webcamEnabled()) {
      return;
    }
    if (LobbyLiveKitService.isFirefoxUserAgent()) {
      return;
    }
    if (this.primedLocalVideo !== null) {
      return;
    }
    const preset = webcamQualityPreset(this.gameSettings.webcamQuality());
    this.primedLocalVideo = (async (): Promise<LocalVideoTrack | null> => {
      try {
        return await this.createCameraTrackForPreset(preset.width, preset.height, preset.frameRate);
      } catch {
        return null;
      }
    })();
  }

  public async abandonPrimedLocalVideoCapture(): Promise<void> {
    const track = await this.takePrimedLocalVideoTrack();
    if (track !== null) {
      track.stop();
    }
  }

  public async connect(credentials: LiveKitCredentialsPayload): Promise<void> {
    await this.disconnect();
    const generation = this.connectGeneration + 1;
    this.connectGeneration = generation;
    const preset = webcamQualityPreset(this.gameSettings.webcamQuality());
    const room = new Room({
      adaptiveStream: false,
      dynacast: false,
      webAudioMix: false,
      singlePeerConnection: !LobbyLiveKitService.isFirefoxUserAgent(),
      publishDefaults: {
        simulcast: false,
        videoCodec: 'vp8',
        backupCodec: false,
      },
    });
    this.room = room;

    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      this.handleRemoteTrack(track, publication, participant);
    });
    room.on(RoomEvent.TrackUnsubscribed, (track, _publication, participant) => {
      if (track.kind !== Track.Kind.Video) {
        return;
      }
      const seat = this.resolveSeat(participant);
      if (seat === null) {
        return;
      }
      const video = this.remoteVideos.get(seat);
      if (video !== undefined) {
        track.detach(video);
        this.remoteVideos.delete(seat);
        this.remoteVideoRevision.update((value) => value + 1);
      }
    });
    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      const seat = this.resolveSeat(participant);
      if (seat === null) {
        return;
      }
      this.remoteVideos.delete(seat);
      this.remoteVideoRevision.update((value) => value + 1);
    });
    room.on(RoomEvent.TrackPublished, (publication, _participant) => {
      if (publication.kind === Track.Kind.Video) {
        publication.setSubscribed(true);
      }
    });
    room.on(RoomEvent.ParticipantConnected, (participant) => {
      this.subscribeParticipantVideoOnly(participant);
    });

    try {
      await room.connect(credentials.serverUrl, credentials.token, {
        autoSubscribe: false,
        peerConnectionTimeout: LIVEKIT_PEER_CONNECT_TIMEOUT_MS,
        websocketTimeout: 30_000,
      });
      if (this.connectGeneration !== generation || this.room !== room) {
        await room.disconnect();
        return;
      }
      await this.waitUntilConnected(room);
      if (this.connectGeneration !== generation || this.room !== room) {
        await room.disconnect();
        return;
      }
      this.subscribeExistingRemoteVideo(room);
      await this.delay(POST_CONNECT_PUBLISH_DELAY_MS);
      if (this.connectGeneration !== generation || this.room !== room) {
        await room.disconnect();
        return;
      }
      if (this.gameSettings.webcamEnabled()) {
        try {
          await this.publishCameraTrack(room, preset.width, preset.height, preset.frameRate);
        } catch (publishError: unknown) {
          console.error('LiveKit camera publish failed', publishError);
          await this.abandonPrimedLocalVideoCapture();
          this.localVideoElement.set(null);
        }
      } else {
        await this.abandonPrimedLocalVideoCapture();
      }
    } catch (error) {
      if (this.room === room) {
        this.room = null;
      }
      room.removeAllListeners();
      await room.disconnect();
      await this.abandonPrimedLocalVideoCapture();
      throw error;
    }
  }

  public getRemoteVideoForSeat(seat: PlayerSeat): HTMLVideoElement | null {
    return this.remoteVideos.get(seat) ?? null;
  }

  public async disconnect(): Promise<void> {
    this.connectGeneration += 1;
    this.localVideoElement.set(null);
    this.remoteVideos.clear();
    const room = this.room;
    this.room = null;
    if (room === null) {
      return;
    }
    room.removeAllListeners();
    await room.disconnect();
  }

  private subscribeExistingRemoteVideo(room: Room): void {
    for (const participant of room.remoteParticipants.values()) {
      this.subscribeParticipantVideoOnly(participant);
    }
  }

  private subscribeParticipantVideoOnly(participant: RemoteParticipant): void {
    for (const publication of participant.videoTrackPublications.values()) {
      if (!publication.isSubscribed) {
        publication.setSubscribed(true);
      }
    }
  }

  private async waitUntilConnected(room: Room): Promise<void> {
    if (room.state === ConnectionState.Connected) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const onConnected = (): void => {
        cleanup();
        resolve();
      };
      const onDisconnected = (): void => {
        cleanup();
        reject(new Error('LiveKit disconnected before ready'));
      };
      const cleanup = (): void => {
        room.off(RoomEvent.Connected, onConnected);
        room.off(RoomEvent.Disconnected, onDisconnected);
      };
      room.on(RoomEvent.Connected, onConnected);
      room.on(RoomEvent.Disconnected, onDisconnected);
    });
  }

  private async takePrimedLocalVideoTrack(): Promise<LocalVideoTrack | null> {
    const pending = this.primedLocalVideo;
    this.primedLocalVideo = null;
    if (pending === null) {
      return null;
    }
    return pending;
  }

  private async publishCameraTrack(
    room: Room,
    width: number,
    height: number,
    frameRate: number,
  ): Promise<void> {
    let videoTrack = await this.takePrimedLocalVideoTrack();
    if (videoTrack === null) {
      videoTrack = await Promise.race([
        this.createCameraTrackForPreset(width, height, frameRate),
        this.rejectAfter(CAMERA_PUBLISH_TIMEOUT_MS, 'LiveKit camera publish timed out'),
      ]);
    }
    try {
      const publication = await room.localParticipant.publishTrack(videoTrack, {
        source: Track.Source.Camera,
        simulcast: false,
      });
      if (publication.track === undefined) {
        return;
      }
      const element = publication.track.attach() as HTMLVideoElement;
      element.muted = true;
      element.playsInline = true;
      void element.play().catch(() => undefined);
      this.localVideoElement.set(element);
    } catch (error) {
      videoTrack.stop();
      throw error;
    }
  }

  private handleRemoteTrack(
    track: Track,
    _publication: RemoteTrackPublication,
    participant: RemoteParticipant | LocalParticipant,
  ): void {
    if (track.kind !== Track.Kind.Video) {
      return;
    }
    const seat = this.resolveSeat(participant);
    if (seat === null) {
      return;
    }
    let video = this.remoteVideos.get(seat);
    if (video === undefined) {
      video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      this.remoteVideos.set(seat, video);
    }
    track.attach(video);
    void video.play().catch(() => undefined);
    this.remoteVideoRevision.update((value) => value + 1);
  }

  private resolveSeat(participant: RemoteParticipant | LocalParticipant): PlayerSeat | null {
    const metadata = participant.metadata;
    if (metadata === undefined || metadata.length === 0) {
      return null;
    }
    try {
      const parsed = JSON.parse(metadata) as LiveKitParticipantMetadata;
      if (parsed.seat === undefined) {
        return null;
      }
      return parsed.seat;
    } catch {
      return null;
    }
  }

  private static isFirefoxUserAgent(): boolean {
    const nav = typeof globalThis === 'undefined' ? undefined : globalThis.navigator;
    if (nav === undefined || typeof nav.userAgent !== 'string') {
      return false;
    }
    return /firefox/i.test(nav.userAgent);
  }

  private async createCameraTrackForPreset(
    width: number,
    height: number,
    frameRate: number,
  ): Promise<LocalVideoTrack> {
    const mobile = isLikelyMobileWebcamHost();
    const attempts = LobbyLiveKitService.isFirefoxUserAgent()
      ? LobbyLiveKitService.firefoxVideoCaptureAttempts(width, height, frameRate, mobile)
      : LobbyLiveKitService.nonFirefoxVideoCaptureAttempts(width, height, frameRate, mobile);
    let lastError: unknown;
    for (let i = 0; i < attempts.length; i += 1) {
      try {
        return await createLocalVideoTrack(attempts[i]);
      } catch (error: unknown) {
        lastError = error;
      }
    }
    throw lastError;
  }

  private static firefoxVideoCaptureAttempts(
    width: number,
    height: number,
    frameRate: number,
    mobile: boolean,
  ): VideoCaptureOptions[] {
    if (mobile) {
      return [
        { facingMode: 'user' },
        { facingMode: 'user', resolution: VideoPresets.h90.resolution },
        { facingMode: 'user', resolution: VideoPresets.h180.resolution },
        {
          facingMode: 'user',
          resolution: { width: 320, height: 240, frameRate: Math.min(frameRate, 15) },
        },
        { facingMode: 'user', resolution: { width, height, frameRate } },
        {},
        { resolution: { width, height, frameRate } },
      ];
    }
    return [
      {},
      { facingMode: 'user' },
      { resolution: VideoPresets.h90.resolution },
      { resolution: VideoPresets.h180.resolution },
      { resolution: { width: 320, height: 240, frameRate: Math.min(frameRate, 15) } },
      { resolution: { width, height, frameRate } },
    ];
  }

  private static nonFirefoxVideoCaptureAttempts(
    width: number,
    height: number,
    frameRate: number,
    mobile: boolean,
  ): VideoCaptureOptions[] {
    if (mobile) {
      return [
        { facingMode: 'user', resolution: { width, height, frameRate } },
        { facingMode: 'user', resolution: VideoPresets.h180.resolution },
        {
          facingMode: 'user',
          resolution: { width: 320, height: 240, frameRate: Math.min(frameRate, 15) },
        },
        { facingMode: 'user' },
        { resolution: { width, height, frameRate } },
        { resolution: VideoPresets.h180.resolution },
        { resolution: { width: 320, height: 240, frameRate: Math.min(frameRate, 15) } },
      ];
    }
    return [
      { resolution: { width, height, frameRate } },
      { resolution: VideoPresets.h180.resolution },
      { resolution: { width: 320, height: 240, frameRate: Math.min(frameRate, 15) } },
    ];
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private rejectAfter(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(message));
      }, ms);
    });
  }
}
