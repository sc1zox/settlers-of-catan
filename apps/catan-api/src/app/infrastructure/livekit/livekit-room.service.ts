import { Injectable, Logger } from '@nestjs/common';
import { PlayerSeat, ProcessEnvKey } from '@catan/api-interfaces';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { optionalEnvString, requireEnvString } from '../../config/required-env.util';

export interface LiveKitJoinGrant {
  readonly serverUrl: string;
  readonly token: string;
  readonly roomName: string;
}

@Injectable()
export class LiveKitRoomService {
  private readonly logger = new Logger(LiveKitRoomService.name);
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly publicUrl: string;
  private readonly roomClient: RoomServiceClient | null;

  public constructor() {
    this.apiKey = requireEnvString(ProcessEnvKey.LiveKitApiKey);
    this.apiSecret = requireEnvString(ProcessEnvKey.LiveKitApiSecret);
    this.publicUrl = optionalEnvString(ProcessEnvKey.LiveKitPublicUrl, 'ws://localhost:7880');
    const httpUrl = optionalEnvString(ProcessEnvKey.LiveKitHttpUrl, 'http://127.0.0.1:7880');
    this.roomClient = new RoomServiceClient(httpUrl, this.apiKey, this.apiSecret);
  }

  public async ensureRoom(roomName: string): Promise<void> {
    if (this.roomClient === null) {
      return;
    }
    try {
      await this.roomClient.createRoom({ name: roomName, emptyTimeout: 300, maxParticipants: 4 });
    } catch (error: unknown) {
      const message = String(error);
      if (!message.toLowerCase().includes('already exists')) {
        this.logger.debug('LiveKit createRoom failed');
      }
    }
  }

  public async deleteRoom(roomName: string): Promise<void> {
    if (this.roomClient === null) {
      return;
    }
    try {
      await this.roomClient.deleteRoom(roomName);
    } catch (error: unknown) {
      this.logger.debug('LiveKit deleteRoom failed');
    }
  }

  public async issueJoinToken(params: {
    readonly roomName: string;
    readonly identity: string;
    readonly displayName: string;
    readonly seat: PlayerSeat;
    readonly canPublish: boolean;
  }): Promise<LiveKitJoinGrant> {
    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity: params.identity,
      name: params.displayName,
      ttl: '6h',
      metadata: JSON.stringify({ seat: params.seat }),
    });
    token.addGrant({
      roomJoin: true,
      room: params.roomName,
      canPublish: params.canPublish,
      canSubscribe: true,
    });
    const jwt = await token.toJwt();
    return {
      serverUrl: this.publicUrl,
      token: jwt,
      roomName: params.roomName,
    };
  }
}
