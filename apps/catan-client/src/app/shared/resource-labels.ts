import { ResourceType } from '@catan/api-interfaces';

/** Fixed display order for resource rows / pickers across the in-game UI. */
export const RESOURCE_TYPE_ORDER: readonly ResourceType[] = [
  ResourceType.Wood,
  ResourceType.Brick,
  ResourceType.Wheat,
  ResourceType.Wool,
  ResourceType.Ore,
];

/** German labels for wire resource types — UI strings throughout the client are German. */
export const RESOURCE_TYPE_LABEL_DE: Readonly<Record<ResourceType, string>> = {
  [ResourceType.Wood]: 'Holz',
  [ResourceType.Brick]: 'Lehm',
  [ResourceType.Wheat]: 'Getreide',
  [ResourceType.Wool]: 'Wolle',
  [ResourceType.Ore]: 'Erz',
};
