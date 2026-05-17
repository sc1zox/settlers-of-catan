import { ResourceType } from '@catan/api-interfaces';
import { EnumTranslate } from '../../game/i18n/enum-translate.helper';
import { TranslateInstantFn } from './translate-instant-fn';

export const RESOURCE_TYPE_ORDER: readonly ResourceType[] = [
  ResourceType.Wood,
  ResourceType.Brick,
  ResourceType.Wheat,
  ResourceType.Wool,
  ResourceType.Ore,
];

export function resourceTypeLabel(instant: TranslateInstantFn, type: ResourceType): string {
  return EnumTranslate.translateResourceType(instant, type);
}
