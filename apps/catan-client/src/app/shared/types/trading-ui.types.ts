import { PlayerSeat, ResourceType } from '@catan/api-interfaces';

export interface TradePartner {
  readonly seat: PlayerSeat;
  readonly name: string;
}

export interface BankTradeRequest {
  readonly give: ResourceType;
  readonly amount: number;
  readonly receive: ResourceType;
}

export interface ProposeTradeRequest {
  readonly toSeat: PlayerSeat;
  readonly offer: Readonly<Record<ResourceType, number>>;
  readonly request: Readonly<Record<ResourceType, number>>;
}
