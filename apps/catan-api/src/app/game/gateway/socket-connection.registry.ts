export class SocketConnectionRegistry {
  private readonly socketToSession = new Map<string, string>();
  private readonly sessionToSocket = new Map<string, string>();

  public bind(socketId: string, sessionToken: string): string | undefined {
    const previousSocket = this.sessionToSocket.get(sessionToken);
    if (previousSocket && previousSocket !== socketId) {
      this.socketToSession.delete(previousSocket);
    }
    this.socketToSession.set(socketId, sessionToken);
    this.sessionToSocket.set(sessionToken, socketId);
    if (previousSocket !== undefined && previousSocket !== socketId) {
      return previousSocket;
    }
    return undefined;
  }

  public unbindSocket(socketId: string): string | undefined {
    const session = this.socketToSession.get(socketId);
    if (session === undefined) {
      return undefined;
    }
    this.socketToSession.delete(socketId);
    const mapped = this.sessionToSocket.get(session);
    if (mapped === socketId) {
      this.sessionToSocket.delete(session);
    }
    return session;
  }

  public getSessionToken(socketId: string): string | undefined {
    return this.socketToSession.get(socketId);
  }

  public getSocketId(sessionToken: string): string | undefined {
    return this.sessionToSocket.get(sessionToken);
  }
}
