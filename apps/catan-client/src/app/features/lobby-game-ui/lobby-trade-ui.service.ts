import { computed, inject, Injectable } from '@angular/core';
import {
  PlayerHarborRatesDto,
  ResourceType,
  TradeOfferDto,
  TradeStatus,
} from '@catan/api-interfaces';
import type { TradePartner } from '../trading/trading-ui.types';
import { LobbyGameUiStateService } from './lobby-game-ui-state.service';

const ZERO_RESOURCES: Readonly<Record<ResourceType, number>> = {
  [ResourceType.Wood]: 0,
  [ResourceType.Brick]: 0,
  [ResourceType.Wheat]: 0,
  [ResourceType.Wool]: 0,
  [ResourceType.Ore]: 0,
};

const DEFAULT_HARBOR_RATES: PlayerHarborRatesDto = {
  generic: 4,
  perResource: {
    [ResourceType.Wood]: 4,
    [ResourceType.Brick]: 4,
    [ResourceType.Wheat]: 4,
    [ResourceType.Wool]: 4,
    [ResourceType.Ore]: 4,
  },
};

@Injectable({ providedIn: 'root' })
export class LobbyTradeUiService {
  private readonly state = inject(LobbyGameUiStateService);

  public readonly tradePartners = computed<readonly TradePartner[]>(() => {
    const payload = this.state.rawLobbyState();
    if (payload === undefined) {
      return [];
    }
    return payload.players
      .filter((player) => !player.isSelf)
      .map((player) => ({ seat: player.seat, name: player.displayName }));
  });

  /**
   * Pull the player-relevant open trade straight from the server-authoritative
   * FullState. A reconnecting client sees the same active offer as everyone
   * else; the transient `TradeUpdated` event is no longer the source of truth
   * (it stays around as an animation/UX-transition hint).
   */
  public readonly pendingTrade = computed<TradeOfferDto | null>(() => {
    const payload = this.state.rawLobbyState();
    const seat = this.state.selfSeat();
    if (payload === undefined || seat === null) {
      return null;
    }
    for (let i = 0; i < payload.activeTrades.length; i += 1) {
      const trade = payload.activeTrades[i];
      if (trade.status !== TradeStatus.Open) {
        continue;
      }
      if (trade.fromSeat === seat) {
        return trade;
      }
      for (let j = 0; j < trade.recipients.length; j += 1) {
        if (trade.recipients[j].seat === seat) {
          return trade;
        }
      }
    }
    return null;
  });

  public readonly selfResources = computed<Readonly<Record<ResourceType, number>>>(
    () => this.state.selfPlayer()?.resources ?? ZERO_RESOURCES,
  );

  public readonly selfHarborRates = computed<PlayerHarborRatesDto>(
    () => this.state.selfPlayer()?.harborRates ?? DEFAULT_HARBOR_RATES,
  );

  public readonly selfHasOpenTrade = computed<boolean>(() => {
    const trade = this.pendingTrade();
    const seat = this.state.selfSeat();
    if (trade === null || seat === null) {
      return false;
    }
    if (trade.fromSeat === seat) {
      return true;
    }
    for (let i = 0; i < trade.recipients.length; i += 1) {
      if (trade.recipients[i].seat === seat) {
        return true;
      }
    }
    return false;
  });
}
