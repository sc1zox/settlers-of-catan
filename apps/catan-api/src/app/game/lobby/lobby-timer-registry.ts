interface HasDisconnectTimer {
  disconnectTimer: NodeJS.Timeout | null;
}

export class LobbyTimerRegistry {
  private emptyLobbyCleanupTimer: NodeJS.Timeout | null = null;
  private summaryEntryTimer: NodeJS.Timeout | null = null;
  private summaryHardEndTimer: NodeJS.Timeout | null = null;

  public isEmptyLobbyCleanupPending(): boolean {
    return this.emptyLobbyCleanupTimer !== null;
  }

  public isSummaryEntryPending(): boolean {
    return this.summaryEntryTimer !== null;
  }

  public clearDisconnectTimer(player: HasDisconnectTimer): void {
    if (player.disconnectTimer) {
      clearTimeout(player.disconnectTimer);
      player.disconnectTimer = null;
    }
  }

  public startDisconnectHold(player: HasDisconnectTimer, delayMs: number, onExpire: () => void): void {
    this.clearDisconnectTimer(player);
    player.disconnectTimer = setTimeout(onExpire, delayMs);
  }

  public clearEmptyLobbyCleanupTimer(): void {
    if (this.emptyLobbyCleanupTimer) {
      clearTimeout(this.emptyLobbyCleanupTimer);
      this.emptyLobbyCleanupTimer = null;
    }
  }

  public startEmptyLobbyCleanupHold(delayMs: number, onExpire: () => void): void {
    this.clearEmptyLobbyCleanupTimer();
    this.emptyLobbyCleanupTimer = setTimeout(() => {
      this.emptyLobbyCleanupTimer = null;
      onExpire();
    }, delayMs);
  }

  public clearSummaryEntryTimer(): void {
    if (this.summaryEntryTimer) {
      clearTimeout(this.summaryEntryTimer);
      this.summaryEntryTimer = null;
    }
  }

  public startSummaryEntryHold(delayMs: number, onExpire: () => void): void {
    this.clearSummaryEntryTimer();
    this.summaryEntryTimer = setTimeout(() => {
      this.summaryEntryTimer = null;
      onExpire();
    }, delayMs);
  }

  public clearSummaryHardEndTimer(): void {
    if (this.summaryHardEndTimer) {
      clearTimeout(this.summaryHardEndTimer);
      this.summaryHardEndTimer = null;
    }
  }

  public startSummaryHardEndHold(delayMs: number, onExpire: () => void): void {
    this.clearSummaryHardEndTimer();
    this.summaryHardEndTimer = setTimeout(() => {
      this.summaryHardEndTimer = null;
      onExpire();
    }, delayMs);
  }

  public clearAll(players: readonly HasDisconnectTimer[]): void {
    for (let i = 0; i < players.length; i += 1) {
      this.clearDisconnectTimer(players[i]);
    }
    this.clearEmptyLobbyCleanupTimer();
    this.clearSummaryEntryTimer();
    this.clearSummaryHardEndTimer();
  }
}
