import { Injectable } from '@nestjs/common';
import { ResourceType } from '@catan/api-interfaces';
import type { LobbyPlayerSlot } from '../lobby/lobby-runtime';
import { CITY_COST, DEV_CARD_COST, ROAD_COST, SETTLEMENT_COST } from './build-resource-costs';

@Injectable()
export class ResourceCostService {
  public deductSettlementCost(player: LobbyPlayerSlot): void {
    const keys = Object.keys(SETTLEMENT_COST) as ResourceType[];
    for (let i = 0; i < keys.length; i += 1) {
      const r = keys[i];
      const need = SETTLEMENT_COST[r] ?? 0;
      player.resources[r] = (player.resources[r] ?? 0) - need;
    }
  }

  public deductRoadCost(player: LobbyPlayerSlot): void {
    const keys = Object.keys(ROAD_COST) as ResourceType[];
    for (let i = 0; i < keys.length; i += 1) {
      const resource = keys[i];
      const need = ROAD_COST[resource] ?? 0;
      player.resources[resource] = (player.resources[resource] ?? 0) - need;
    }
  }

  public deductCityCost(player: LobbyPlayerSlot): void {
    const keys = Object.keys(CITY_COST) as ResourceType[];
    for (let i = 0; i < keys.length; i += 1) {
      const resource = keys[i];
      const need = CITY_COST[resource] ?? 0;
      player.resources[resource] = (player.resources[resource] ?? 0) - need;
    }
  }

  public deductDevCardCost(player: LobbyPlayerSlot): void {
    const keys = Object.keys(DEV_CARD_COST) as ResourceType[];
    for (let i = 0; i < keys.length; i += 1) {
      const resource = keys[i];
      const need = DEV_CARD_COST[resource] ?? 0;
      player.resources[resource] = (player.resources[resource] ?? 0) - need;
    }
  }
}
