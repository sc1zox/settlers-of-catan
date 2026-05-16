import { computed, inject, Injectable } from '@angular/core';
import { ResourceType, TradeOfferDto, TradeStatus } from '@catan/api-interfaces';
import { TradingStateService } from '../trading/trading-state.service';
import type { TradePartner } from '../../shared/types/trading-ui.types';
import { LobbyGameUiStateService } from './lobby-game-ui-state.service';

const ZERO_RESOURCES: Readonly<Record<ResourceType, number>> = {
  [ResourceType.Wood]: 0,
  [ResourceType.Brick]: 0,
  [ResourceType.Wheat]: 0,
  [ResourceType.Wool]: 0,
  [ResourceType.Ore]: 0,
};

@Injectable({ providedIn: 'root' })
export class LobbyTradeUiService {
  private readonly state = inject(LobbyGameUiStateService);
  private readonly tradingState = inject(TradingStateService);

  public readonly tradePartners = computed<readonly TradePartner[]>(() => {
    const payload = this.state.rawLobbyState();
    if (payload === undefined) {
      return [];
    }
    return payload.players
      .filter((player) => !player.isSelf)
      .map((player) => ({ seat: player.seat, name: player.displayName }));
  });

  public readonly pendingTrade = computed<TradeOfferDto | null>(() => {
    const update = this.tradingState.tradeUpdated.value();
    if (update === undefined) {
      return null;
    }
    return update.trade.status === TradeStatus.Open ? update.trade : null;
  });

  public readonly selfResources = computed<Readonly<Record<ResourceType, number>>>(
    () => this.state.selfPlayer()?.resources ?? ZERO_RESOURCES,
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
