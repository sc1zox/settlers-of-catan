import {
  PlayerSeat,
  ResourceType,
  TradeRecipientStatus,
  TradeStatus,
  TradeUpdateKind,
  type TradeOfferDto,
  type TradeUpdatedPayload,
} from '@catan/api-interfaces';

export function makeTradeOffer(overrides: Partial<TradeOfferDto> = {}): TradeOfferDto {
  return {
    id: 'trade-1',
    lobbyId: 'lobby-canonical',
    fromSeat: PlayerSeat.North,
    offer: { [ResourceType.Wood]: 1 },
    request: { [ResourceType.Wheat]: 1 },
    recipients: [{ seat: PlayerSeat.East, status: TradeRecipientStatus.Pending }],
    status: TradeStatus.Open,
    ...overrides,
  };
}

export function makeTradeUpdated(
  kind: TradeUpdateKind,
  trade: TradeOfferDto,
  lobbyId = 'lobby-canonical',
): TradeUpdatedPayload {
  return {
    lobbyId,
    trade,
    kind,
    actorSeat: PlayerSeat.North,
  };
}
