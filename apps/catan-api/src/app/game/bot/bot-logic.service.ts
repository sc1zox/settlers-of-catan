import { Injectable } from '@nestjs/common';
import { GamePhase, PlayerSeat, ResourceType, TileType } from '@catan/api-interfaces';
import { collectRobberVictimSeats, makeTileKey } from '@catan/shared-game-field';
import { GameActionValidationService } from '../validation/game-action-validation.service';
import { LobbyRuntime, type LobbyPlayerSlot } from '../lobby/lobby-runtime';
import { countResourceCards } from '../utils/public-player-resources.util';

export type BotAction =
  | { type: 'rollDice' }
  | { type: 'moveRobber'; q: number; r: number; victimSeat?: PlayerSeat }
  | { type: 'discard'; resources: Readonly<Partial<Record<ResourceType, number>>> }
  | { type: 'buildSettlement'; vertexId: string }
  | { type: 'buildCity'; vertexId: string }
  | { type: 'buildRoad'; edgeId: string }
  | { type: 'buyDevCard' }
  | { type: 'endTurn' }
  | { type: 'completeTrading' }
  | { type: 'none' };

export enum BotTradeDecisionKind {
  Accept = 'accept',
  Reject = 'reject',
  Counter = 'counter',
}

export type BotTradeDecision =
  | { kind: BotTradeDecisionKind.Accept }
  | { kind: BotTradeDecisionKind.Reject }
  | {
      kind: BotTradeDecisionKind.Counter;
      /** What the original sender (human) gives under the counter (sender perspective). */
      offer: Partial<Record<ResourceType, number>>;
      /** What the original sender (human) receives under the counter — bot must own this. */
      request: Partial<Record<ResourceType, number>>;
    };

@Injectable()
export class BotLogicService {
  public constructor(private readonly validation: GameActionValidationService) {}

  public decideMainGameAction(lobby: LobbyRuntime, bot: LobbyPlayerSlot): BotAction {
    const phase = lobby.fsm.getPhase();

    if (phase === GamePhase.Rolling) {
      return { type: 'rollDice' };
    }

    if (phase === GamePhase.RobberMove) {
      const pick = this.pickRobberMove(lobby, bot);
      if (pick) {
        return { type: 'moveRobber', q: pick.q, r: pick.r, victimSeat: pick.victimSeat };
      }
      return this.pickFallbackRobberMove(lobby);
    }

    if (phase === GamePhase.Trading) {
      return { type: 'completeTrading' };
    }

    if (phase === GamePhase.Building) {
      const moves = this.validation.computeLegalMoves(lobby, bot.seat);
      if (moves.cities.length > 0) {
        return { type: 'buildCity', vertexId: moves.cities[0] };
      }
      if (moves.settlements.length > 0) {
        let bestVertex = moves.settlements[0];
        let bestScore = -1;
        for (const v of moves.settlements) {
          const score = this.rateVertexProduction(lobby, v);
          if (score > bestScore) {
            bestScore = score;
            bestVertex = v;
          }
        }
        return { type: 'buildSettlement', vertexId: bestVertex };
      }
      if (this.validation.canAffordDevCardCost(bot) && lobby.devDeck.length > 0) {
        return { type: 'buyDevCard' };
      }
      if (moves.roads.length > 0) {
        const roadCount = lobby.roads.filter((r) => r.seat === bot.seat).length;
        if (roadCount < 15) {
          return { type: 'buildRoad', edgeId: moves.roads[0] };
        }
      }
      return { type: 'endTurn' };
    }

    return { type: 'none' };
  }

  public pickRobberDiscard(lobby: LobbyRuntime, bot: LobbyPlayerSlot): BotAction {
    const expected = lobby.requiredRobberDiscardCount(bot);
    const discard: Partial<Record<ResourceType, number>> = {};
    const keys = Object.values(ResourceType);
    let remaining = expected;
    for (let round = 0; round < 16 && remaining > 0; round += 1) {
      for (let k = 0; k < keys.length && remaining > 0; k += 1) {
        const resource = keys[k];
        const have = bot.resources[resource] ?? 0;
        const already = discard[resource] ?? 0;
        if (have > already) {
          discard[resource] = already + 1;
          remaining -= 1;
        }
      }
    }
    return { type: 'discard', resources: discard };
  }

  private pickFallbackRobberMove(lobby: LobbyRuntime): BotAction {
    for (let i = 0; i < lobby.tiles.length; i += 1) {
      const tile = lobby.tiles[i];
      if (tile.type === TileType.Water || tile.type === TileType.Desert) {
        continue;
      }
      if (tile.coord.q === lobby.robberCoord.q && tile.coord.r === lobby.robberCoord.r) {
        continue;
      }
      return { type: 'moveRobber', q: tile.coord.q, r: tile.coord.r, victimSeat: undefined };
    }
    return { type: 'none' };
  }

  public pickRobberMove(
    lobby: LobbyRuntime,
    actor: LobbyPlayerSlot,
  ): { q: number; r: number; victimSeat: PlayerSeat | undefined } | null {
    let bestMove: { q: number; r: number; victimSeat: PlayerSeat | undefined } | null = null;
    let bestScore = -1000;

    for (let i = 0; i < lobby.tiles.length; i += 1) {
      const tile = lobby.tiles[i];
      if (tile.type === TileType.Water || tile.type === TileType.Desert) {
        continue;
      }
      if (tile.coord.q === lobby.robberCoord.q && tile.coord.r === lobby.robberCoord.r) {
        continue;
      }

      let score = 0;
      const tileKey = makeTileKey(tile.coord.q, tile.coord.r);
      const prob = tile.number ? 6 - Math.abs(7 - tile.number) : 0;

      const victims = collectRobberVictimSeats(
        lobby.tiles,
        lobby.settlements.map((s) => ({ seat: s.seat, vertexId: s.vertexId })),
        lobby.players.map((p) => ({
          seat: p.seat,
          totalResourceCards: countResourceCards(p),
        })),
        actor.seat,
        tile.coord.q,
        tile.coord.r,
      );

      const isActorAtTile = lobby.settlements.some(
        (s) =>
          s.seat === actor.seat &&
          lobby.verticesById.get(s.vertexId)?.adjacentTileKeys.includes(tileKey),
      );

      if (isActorAtTile) {
        score -= prob * 10;
      }

      for (const victimSeat of victims) {
        score += prob * 5;
        const victim = lobby.findPlayerBySeat(victimSeat as PlayerSeat);
        if (victim) {
          score += victim.visibleVictoryPoints * 2;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        const victimSeat = victims.length > 0 ? (victims[0] as PlayerSeat) : undefined;
        bestMove = { q: tile.coord.q, r: tile.coord.r, victimSeat };
      }
    }
    return bestMove;
  }

  public pickLegalSetupSettlementVertex(lobby: LobbyRuntime, bot: LobbyPlayerSlot): string | null {
    const vertexIds = Array.from(lobby.verticesById.keys());
    let bestVertexId: string | null = null;
    let bestScore = -1;

    for (const vertexId of vertexIds) {
      if (this.validation.canPlaceSettlementAtVertex(lobby, bot, vertexId, false)) {
        const score = this.rateVertexProduction(lobby, vertexId);
        if (score > bestScore) {
          bestScore = score;
          bestVertexId = vertexId;
        }
      }
    }
    return bestVertexId;
  }

  public pickLegalSetupRoadEdge(
    lobby: LobbyRuntime,
    bot: LobbyPlayerSlot,
    requiredVertexId: string,
  ): string | null {
    const edgeIds = Array.from(lobby.edgesById.keys());
    let bestEdgeId: string | null = null;
    let bestScore = -1;

    for (const edgeId of edgeIds) {
      if (this.validation.canPlaceRoadAtEdge(lobby, bot, edgeId, requiredVertexId)) {
        const edge = lobby.edgesById.get(edgeId);
        if (!edge) {
          continue;
        }
        const otherVertexId = edge.aVertexId === requiredVertexId ? edge.bVertexId : edge.aVertexId;
        const score = this.rateVertexProduction(lobby, otherVertexId);
        if (score > bestScore) {
          bestScore = score;
          bestEdgeId = edgeId;
        }
      }
    }
    return bestEdgeId;
  }

  public rateVertexProduction(lobby: LobbyRuntime, vertexId: string): number {
    const vertex = lobby.verticesById.get(vertexId);
    if (!vertex) {
      return 0;
    }
    let score = 0;
    for (const tileKey of vertex.adjacentTileKeys) {
      const tile = lobby.tiles.find((t) => makeTileKey(t.coord.q, t.coord.r) === tileKey);
      if (tile && tile.number !== null) {
        const prob = 6 - Math.abs(7 - tile.number);
        score += prob;
      }
    }
    return score;
  }

  /**
   * Decide how the bot should respond to an incoming trade proposal.
   * Parameters are in sender perspective: tradeOffer = what sender gives (bot receives),
   * tradeRequest = what sender wants (bot gives).
   *
   * Bot accepts only if it can pay AND receives at least one resource it needs (has < 2 of).
   * Bot counters with a swap of the requested resource only when it can pay but receives
   * something it does not need — giving the human a chance at a useful deal.
   * In all other cases the bot rejects.
   */
  public evaluateIncomingTrade(
    bot: LobbyPlayerSlot,
    tradeOffer: Readonly<Partial<Record<ResourceType, number>>>,
    tradeRequest: Readonly<Partial<Record<ResourceType, number>>>,
  ): BotTradeDecision {
    if (!this.canAffordResourceMap(bot, tradeRequest)) {
      return { kind: BotTradeDecisionKind.Reject };
    }

    const offerKeys = Object.keys(tradeOffer) as ResourceType[];
    const isReceivingNeeded = offerKeys.some(
      (k) => (tradeOffer[k] ?? 0) > 0 && (bot.resources[k] ?? 0) < 2,
    );

    if (!isReceivingNeeded) {
      return { kind: BotTradeDecisionKind.Reject };
    }

    // Bot needs what it would receive. If the human asks nothing in return, counter
    // with a surplus resource so the exchange is fair.
    const requestTotal = (Object.keys(tradeRequest) as ResourceType[]).reduce(
      (sum, k) => sum + (tradeRequest[k] ?? 0),
      0,
    );
    if (requestTotal === 0) {
      const surplus = this.findSurplusResource(bot);
      if (surplus !== null) {
        return {
          kind: BotTradeDecisionKind.Counter,
          offer: { ...tradeOffer },
          request: { [surplus]: 1 },
        };
      }
    }

    return { kind: BotTradeDecisionKind.Accept };
  }

  private findSurplusResource(bot: LobbyPlayerSlot): ResourceType | null {
    const resources = Object.values(ResourceType);
    for (let i = 0; i < resources.length; i += 1) {
      if ((bot.resources[resources[i]] ?? 0) >= 2) {
        return resources[i];
      }
    }
    return null;
  }

  private canAffordResourceMap(
    bot: LobbyPlayerSlot,
    cost: Readonly<Partial<Record<ResourceType, number>>>,
  ): boolean {
    const keys = Object.keys(cost) as ResourceType[];
    for (let i = 0; i < keys.length; i += 1) {
      const k = keys[i];
      const need = cost[k] ?? 0;
      if (need > 0 && (bot.resources[k] ?? 0) < need) {
        return false;
      }
    }
    return true;
  }

}
