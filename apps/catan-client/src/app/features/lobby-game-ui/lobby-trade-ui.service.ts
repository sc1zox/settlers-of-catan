import { computed, inject, Injectable } from '@angular/core';
import { TradeOfferDto } from '@catan/api-interfaces';
import { TradingStateService } from '../trading/trading-state.service';
import type { TradePartner } from '../../shared/types/trading-ui.types';
import { LobbyGameUiStateService } from './lobby-game-ui-state.service';

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
    const trade = this.tradingState.tradeUpdated.value();
    return trade === undefined ? null : trade.trade;
  });
}
