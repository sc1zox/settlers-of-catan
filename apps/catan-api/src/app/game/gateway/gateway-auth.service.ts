import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import {
  HttpHeaderNameLowercase,
  SocketAuthPayloadKey,
  parseAuthorizationBearerFromUnknown,
} from '@catan/api-interfaces';
import { PlayerSessionJwtService } from '../../session/player-session-jwt.service';
import { SocketConnectionRegistry } from './socket-connection.registry';

@Injectable()
export class GatewayAuthService {
  public constructor(private readonly playerJwt: PlayerSessionJwtService) {}

  public bindHandshakeSession(client: Socket, registry: SocketConnectionRegistry): boolean {
    const sessionId = this.resolveHandshakeSessionId(client);
    if (sessionId === undefined) {
      return false;
    }
    registry.bind(client.id, sessionId);
    return true;
  }

  private resolveHandshakeSessionId(client: Socket): string | undefined {
    let sessionId: string | undefined;
    const raw = client.handshake.auth as Record<string, unknown>;
    const accessKey = SocketAuthPayloadKey.AccessToken;
    const jwtFromAuth = typeof raw[accessKey] === 'string' ? raw[accessKey] : '';
    const headerRaw = client.handshake.headers[HttpHeaderNameLowercase.Authorization];
    const headerValue = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
    const jwtFromBearer = parseAuthorizationBearerFromUnknown(headerValue) ?? '';
    const jwtCandidate = jwtFromAuth.length > 0 ? jwtFromAuth : jwtFromBearer;
    if (jwtCandidate.length > 0) {
      try {
        sessionId = this.playerJwt.verifyAccessToken(jwtCandidate);
      } catch {
        sessionId = undefined;
      }
    }
    return sessionId;
  }
}
