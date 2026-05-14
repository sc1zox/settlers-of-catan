import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import {
  BoardLayoutPayload,
  GameSocketClientEvent,
  GameSocketServerEvent,
  JoinSessionPayload,
} from '@catan/shared-game-field';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class GameSocketService implements OnDestroy {
  private socket: Socket | null = null;

  public connect(): void {
    if (this.socket?.connected) {
      return;
    }
    const url = `${environment.apiBaseUrl}/game`;
    this.socket = io(url, { transports: ['websocket'], autoConnect: true });
  }

  public ngOnDestroy(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  public joinSession(sessionId: string): void {
    const payload: JoinSessionPayload = { sessionId };
    this.socket?.emit(GameSocketClientEvent.JoinSession, payload);
  }

  public onBoardLayout(handler: (layout: BoardLayoutPayload) => void): void {
    this.socket?.on(GameSocketServerEvent.BoardLayout, handler);
  }
}
