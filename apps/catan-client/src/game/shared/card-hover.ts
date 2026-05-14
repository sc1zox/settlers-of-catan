import { DevKind, ResourceKind } from '../cards/textures';

export enum CardHoverGroup {
  Resource = 'resource',
  Development = 'development',
}

export interface CardHoverInfo {
  readonly group: CardHoverGroup;
  readonly resourceKind?: ResourceKind;
  readonly devKind?: DevKind;
}
