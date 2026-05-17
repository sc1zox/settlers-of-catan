import { Injectable } from '@nestjs/common';
import {
  ActionRejectCode,
  assertResourceType,
  DiceRollDto,
  GamePhase,
  PlayerSeat,
  ResourceType,
  TileType,
} from '@catan/api-interfaces';
import { makeTileKey } from '@catan/shared-game-field';
import { resolveHarborRates } from '../utils/harbor-rate.util';
import { GameActionValidationService } from '../validation/game-action-validation.service';
import type { LobbyPlayerSlot } from '../lobby/lobby-runtime';
import { LobbyRuntime } from '../lobby/lobby-runtime';
import { RobberService } from '../robber/robber.service';

@Injectable()
export class EconomyService {
  public constructor(
    private readonly validation: GameActionValidationService,
    private readonly robber: RobberService,
  ) {}

  public createDiceRoll(): DiceRollDto {
    const a = this.randomDie();
    const b = this.randomDie();
    return { a, b, sum: a + b };
  }

  public resolveDiceRoll(lobby: LobbyRuntime, roll: DiceRollDto): void {
    if (roll.sum === 7) {
      lobby.pendingRobberDiscardSeats = this.robber.collectRobberDiscardSeats(lobby);
      lobby.fsm.onDiceResolved(true, lobby.pendingRobberDiscardSeats.length > 0);
      return;
    }
    this.applyResourceProduction(lobby, roll.sum);
    lobby.pendingRobberDiscardSeats = [];
    lobby.fsm.onDiceResolved(false, false);
  }

  public grantSetupResourceFromSettlement(
    lobby: LobbyRuntime,
    seat: PlayerSeat,
    vertexId: string,
  ): void {
    const owner = lobby.findPlayerBySeat(seat);
    if (!owner) {
      return;
    }
    const vertex = lobby.verticesById.get(vertexId);
    if (!vertex) {
      return;
    }
    for (let i = 0; i < vertex.adjacentTileKeys.length; i += 1) {
      const tileKey = vertex.adjacentTileKeys[i];
      const tile = this.findTileByKey(lobby, tileKey);
      if (!tile) {
        continue;
      }
      const resource = this.mapTileToResource(tile.type);
      if (!resource) {
        continue;
      }
      owner.resources[resource] = (owner.resources[resource] ?? 0) + 1;
    }
  }

  public bankTradeAsCurrentTurn(
    lobby: LobbyRuntime,
    sessionToken: string,
    giveResource: ResourceType,
    giveAmount: number,
    receiveResource: ResourceType,
  ): void {
    this.validation.assertPhase(lobby, [GamePhase.Trading]);
    const player = this.validation.assertCurrentPlayer(lobby, sessionToken);
    this.bankTrade(lobby, player, giveResource, giveAmount, receiveResource);
  }

  public bankTrade(
    lobby: LobbyRuntime,
    player: LobbyPlayerSlot,
    giveResource: ResourceType,
    giveAmount: number,
    receiveResource: ResourceType,
  ): void {
    assertResourceType(giveResource);
    assertResourceType(receiveResource);
    const giveN = Math.floor(Number(giveAmount));
    const rates = resolveHarborRates(lobby, player.seat);
    const expectedGive = rates.perResource[giveResource];
    if (
      !Number.isFinite(giveN) ||
      giveN !== expectedGive ||
      giveN <= 0 ||
      receiveResource === giveResource
    ) {
      throw new Error(ActionRejectCode.InvalidBankTrade);
    }
    if ((player.resources[giveResource] ?? 0) < giveN) {
      throw new Error(ActionRejectCode.InsufficientResources);
    }
    player.resources[giveResource] = (player.resources[giveResource] ?? 0) - giveN;
    player.resources[receiveResource] = (player.resources[receiveResource] ?? 0) + 1;
  }

  private randomDie(): number {
    return 1 + Math.floor(Math.random() * 6);
  }

  private applyResourceProduction(lobby: LobbyRuntime, rolledNumber: number): void {
    for (let i = 0; i < lobby.settlements.length; i += 1) {
      const settlement = lobby.settlements[i];
      const vertex = lobby.verticesById.get(settlement.vertexId);
      if (!vertex) {
        continue;
      }
      const owner = lobby.findPlayerBySeat(settlement.seat);
      if (!owner) {
        continue;
      }
      for (let tileIndex = 0; tileIndex < vertex.adjacentTileKeys.length; tileIndex += 1) {
        const tileKey = vertex.adjacentTileKeys[tileIndex];
        const tile = this.findTileByKey(lobby, tileKey);
        if (!tile || tile.number !== rolledNumber) {
          continue;
        }
        if (tile.coord.q === lobby.robberCoord.q && tile.coord.r === lobby.robberCoord.r) {
          continue;
        }
        const resource = this.mapTileToResource(tile.type);
        if (!resource) {
          continue;
        }
        const amount = settlement.isCity ? 2 : 1;
        owner.resources[resource] = (owner.resources[resource] ?? 0) + amount;
      }
    }
  }

  private mapTileToResource(type: TileType): ResourceType | null {
    if (type === TileType.Forest) {
      return ResourceType.Wood;
    }
    if (type === TileType.Hills) {
      return ResourceType.Brick;
    }
    if (type === TileType.Fields) {
      return ResourceType.Wheat;
    }
    if (type === TileType.Pasture) {
      return ResourceType.Wool;
    }
    if (type === TileType.Mountains) {
      return ResourceType.Ore;
    }
    return null;
  }

  private findTileByKey(lobby: LobbyRuntime, tileKey: string) {
    for (let i = 0; i < lobby.tiles.length; i += 1) {
      const tile = lobby.tiles[i];
      if (makeTileKey(tile.coord.q, tile.coord.r) === tileKey) {
        return tile;
      }
    }
    return undefined;
  }
}
