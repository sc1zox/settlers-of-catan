import { ResourceType } from '@catan/api-interfaces';

export const SETTLEMENT_COST: Readonly<Partial<Record<ResourceType, number>>> = {
  [ResourceType.Wood]: 1,
  [ResourceType.Brick]: 1,
  [ResourceType.Wheat]: 1,
  [ResourceType.Wool]: 1,
};

export const ROAD_COST: Readonly<Partial<Record<ResourceType, number>>> = {
  [ResourceType.Wood]: 1,
  [ResourceType.Brick]: 1,
};

export const CITY_COST: Readonly<Partial<Record<ResourceType, number>>> = {
  [ResourceType.Wheat]: 2,
  [ResourceType.Ore]: 3,
};

export const DEV_CARD_COST: Readonly<Partial<Record<ResourceType, number>>> = {
  [ResourceType.Wheat]: 1,
  [ResourceType.Wool]: 1,
  [ResourceType.Ore]: 1,
};
