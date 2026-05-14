import { Injectable } from '@nestjs/common';
import { ActionRejectCode, GamePhase, ResourceType } from '@catan/api-interfaces';
import type { LobbyPlayerSlot, LobbyRuntime } from './lobby-runtime';

const SETTLEMENT_COST: Readonly<Partial<Record<ResourceType, number>>> = {
  [ResourceType.Wood]: 1,
  [ResourceType.Brick]: 1,
  [ResourceType.Wheat]: 1,
  [ResourceType.Wool]: 1,
};

@Injectable()
export class GameActionValidationService {
  public assertCurrentPlayer(lobby: LobbyRuntime, sessionToken: string): LobbyPlayerSlot {
    const player = lobby.findPlayerByToken(sessionToken);
    if (!player) {
      throw new Error(ActionRejectCode.PlayerNotInLobby);
    }
    if (player.seat !== lobby.currentSeat) {
      throw new Error(ActionRejectCode.NotYourTurn);
    }
    return player;
  }

  public assertPhase(lobby: LobbyRuntime, allowed: readonly GamePhase[]): void {
    lobby.fsm.assertOneOf(allowed);
  }

  public assertSettlementCost(player: LobbyPlayerSlot): void {
    const keys = Object.keys(SETTLEMENT_COST) as ResourceType[];
    for (let i = 0; i < keys.length; i++) {
      const r = keys[i];
      const need = SETTLEMENT_COST[r] ?? 0;
      if ((player.resources[r] ?? 0) < need) {
        throw new Error(ActionRejectCode.InsufficientResources);
      }
    }
  }

  public assertLegalSettlementCoord(_lobby: LobbyRuntime, _q: number, _r: number): void {
    void _lobby;
    void _q;
    void _r;
  }

  public deductSettlementCost(player: LobbyPlayerSlot): void {
    const keys = Object.keys(SETTLEMENT_COST) as ResourceType[];
    for (let i = 0; i < keys.length; i++) {
      const r = keys[i];
      const need = SETTLEMENT_COST[r] ?? 0;
      player.resources[r] = (player.resources[r] ?? 0) - need;
    }
  }
}
