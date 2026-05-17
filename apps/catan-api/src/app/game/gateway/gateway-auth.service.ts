import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import {
  HttpHeaderNameLowercase,
  SocketAuthPayloadKey,
  SocketClientDataKey,
  parseAuthorizationBearerFromUnknown,
} from '@catan/api-interfaces';
import { PlayerSessionJwtService } from '../../session/player-session-jwt.service';
import { SocketConnectionRegistry } from './socket-connection.registry';

@Injectable()
export class GatewayAuthService {
  public constructor(private readonly playerJwt: PlayerSessionJwtService) {}

  public bindHandshakeSession(
    client: Socket,
    registry: SocketConnectionRegistry,
    server: Server,
  ): boolean {
    const resolved = this.resolveHandshakeSession(client);
    if (resolved === undefined) {
      return false;
    }
    const replacedSocketId = registry.bind(client.id, resolved.sessionId);
    if (replacedSocketId !== undefined) {
      const replaced = server.sockets.sockets.get(replacedSocketId);
      replaced?.disconnect(true);
    }
    this.scheduleAccessTokenExpiryDisconnect(client, resolved.accessToken);
    return true;
  }

  private resolveHandshakeSession(
    client: Socket,
  ): { sessionId: string; accessToken: string } | undefined {
    const raw = client.handshake.auth as Record<string, unknown>;
    const accessKey = SocketAuthPayloadKey.AccessToken;
    const jwtFromAuth = typeof raw[accessKey] === 'string' ? raw[accessKey] : '';
    const headerRaw = client.handshake.headers[HttpHeaderNameLowercase.Authorization];
    const headerValue = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
    const jwtFromBearer = parseAuthorizationBearerFromUnknown(headerValue) ?? '';
    const jwtCandidate = jwtFromAuth.length > 0 ? jwtFromAuth : jwtFromBearer;
    if (jwtCandidate.length === 0) {
      return undefined;
    }
    try {
      const sessionId = this.playerJwt.verifyAccessToken(jwtCandidate);
      return { sessionId, accessToken: jwtCandidate };
    } catch {
      return undefined;
    }
  }

  public clearAccessTokenExpiryDisconnect(client: Socket): void {
    const existingTimer = client.data[SocketClientDataKey.AccessExpiryTimer] as
      | ReturnType<typeof setTimeout>
      | undefined;
    if (existingTimer !== undefined) {
      clearTimeout(existingTimer);
      client.data[SocketClientDataKey.AccessExpiryTimer] = undefined;
    }
  }

  private scheduleAccessTokenExpiryDisconnect(client: Socket, accessToken: string): void {
    this.clearAccessTokenExpiryDisconnect(client);
    const expiresAtMs = this.playerJwt.readAccessTokenExpiryMs(accessToken);
    if (expiresAtMs === undefined) {
      return;
    }
    const delayMs = expiresAtMs - Date.now();
    if (delayMs <= 0) {
      client.disconnect(true);
      return;
    }
    const timer = setTimeout(() => {
      client.disconnect(true);
    }, delayMs);
    client.data[SocketClientDataKey.AccessExpiryTimer] = timer;
  }
}
