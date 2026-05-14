import { randomInt } from 'node:crypto';
import { ActionRejectCode, PlayerSeat, ResourceType } from '@catan/api-interfaces';
import { makeStandardLandPlacements } from '@catan/shared-game-field';
import type { TilePlacement } from '@catan/shared-game-field';
import { TurnStateMachine } from './turn-state-machine';

const SEATS: readonly PlayerSeat[] = [
  PlayerSeat.North,
  PlayerSeat.East,
  PlayerSeat.South,
  PlayerSeat.West,
];

export interface LobbyPlayerSlot {
  sessionToken: string;
  displayName: string;
  seat: PlayerSeat;
  socketId: string | null;
  resources: Record<ResourceType, number>;
  disconnectTimer: NodeJS.Timeout | null;
}

export class LobbyRuntime {
  public readonly lobbyId: string;
  public readonly seed: number;
  public readonly tiles: readonly TilePlacement[];
  public readonly fsm: TurnStateMachine = new TurnStateMachine();
  public currentSeat: PlayerSeat = PlayerSeat.North;
  public readonly players: LobbyPlayerSlot[] = [];

  public constructor(lobbyId: string) {
    this.lobbyId = lobbyId;
    this.seed = randomInt(0, 0xffffffff);
    this.tiles = makeStandardLandPlacements(this.seed);
  }

  public findPlayerBySeat(seat: PlayerSeat): LobbyPlayerSlot | undefined {
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].seat === seat) {
        return this.players[i];
      }
    }
    return undefined;
  }

  public findPlayerByToken(sessionToken: string): LobbyPlayerSlot | undefined {
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].sessionToken === sessionToken) {
        return this.players[i];
      }
    }
    return undefined;
  }

  public findPlayerBySocketId(socketId: string): LobbyPlayerSlot | undefined {
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].socketId === socketId) {
        return this.players[i];
      }
    }
    return undefined;
  }

  public nextFreeSeat(): PlayerSeat | undefined {
    for (let s = 0; s < SEATS.length; s++) {
      const seat = SEATS[s];
      let taken = false;
      for (let p = 0; p < this.players.length; p++) {
        if (this.players[p].seat === seat) {
          taken = true;
          break;
        }
      }
      if (!taken) {
        return seat;
      }
    }
    return undefined;
  }

  public emptyResourceBag(): Record<ResourceType, number> {
    return {
      [ResourceType.Wood]: 0,
      [ResourceType.Brick]: 0,
      [ResourceType.Wheat]: 0,
      [ResourceType.Wool]: 0,
      [ResourceType.Ore]: 0,
    };
  }

  public addPlayer(sessionToken: string, displayName: string, socketId: string): PlayerSeat {
    const seat = this.nextFreeSeat();
    if (seat === undefined) {
      throw new Error(ActionRejectCode.LobbyFull);
    }
    const resources = this.emptyResourceBag();
    resources[ResourceType.Wood] = 2;
    resources[ResourceType.Brick] = 2;
    resources[ResourceType.Wheat] = 2;
    resources[ResourceType.Wool] = 2;
    resources[ResourceType.Ore] = 2;
    this.players.push({
      sessionToken,
      displayName,
      seat,
      socketId,
      resources,
      disconnectTimer: null,
    });
    return seat;
  }

  public setPlayerSocket(sessionToken: string, socketId: string): void {
    const player = this.findPlayerByToken(sessionToken);
    if (player) {
      player.socketId = socketId;
    }
  }

  public clearDisconnectTimer(player: LobbyPlayerSlot): void {
    if (player.disconnectTimer) {
      clearTimeout(player.disconnectTimer);
      player.disconnectTimer = null;
    }
  }

  public startDisconnectHold(player: LobbyPlayerSlot, delayMs: number, onExpire: () => void): void {
    this.clearDisconnectTimer(player);
    player.disconnectTimer = setTimeout(onExpire, delayMs);
  }
}
