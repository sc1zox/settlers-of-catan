import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { gt } from '../i18n-bridge';

export enum ResourceKind {
  Wood = 'wood',
  Brick = 'brick',
  Wool = 'wool',
  Grain = 'grain',
  Ore = 'ore',
}

export function resourceKindLabel(kind: ResourceKind): string {
  let key: string;
  switch (kind) {
    case ResourceKind.Wood:
      key = 'cardTex.resourceWood';
      break;
    case ResourceKind.Brick:
      key = 'cardTex.resourceBrick';
      break;
    case ResourceKind.Wool:
      key = 'cardTex.resourceWool';
      break;
    case ResourceKind.Grain:
      key = 'cardTex.resourceGrain';
      break;
    case ResourceKind.Ore:
      key = 'cardTex.resourceOre';
      break;
  }
  return gt(marker(key));
}

export interface TexturePalette {
  readonly accent: string;
  readonly accentDark: string;
  readonly accentLight: string;
}

export const RESOURCE_PALETTE: Record<ResourceKind, TexturePalette> = {
  [ResourceKind.Wood]: { accent: '#3a7042', accentDark: '#1f4a26', accentLight: '#a8d49b' },
  [ResourceKind.Brick]: { accent: '#a85a3a', accentDark: '#6b3520', accentLight: '#e0a487' },
  [ResourceKind.Wool]: { accent: '#9fc960', accentDark: '#5e8a30', accentLight: '#dfeec0' },
  [ResourceKind.Grain]: { accent: '#d9b25c', accentDark: '#8a6a22', accentLight: '#f1deaa' },
  [ResourceKind.Ore]: { accent: '#6c6f76', accentDark: '#3a3c40', accentLight: '#b8bbc0' },
};

export enum DevKind {
  Knight = 'knight',
  RoadBuilding = 'road',
  YearOfPlenty = 'plenty',
  Monopoly = 'monopoly',
  VictoryPoint = 'vp',
}

export function devKindLabel(kind: DevKind): string {
  let key: string;
  switch (kind) {
    case DevKind.Knight:
      key = 'cardTex.devKnight';
      break;
    case DevKind.RoadBuilding:
      key = 'cardTex.devRoad';
      break;
    case DevKind.YearOfPlenty:
      key = 'cardTex.devPlenty';
      break;
    case DevKind.Monopoly:
      key = 'cardTex.devMonopoly';
      break;
    case DevKind.VictoryPoint:
      key = 'cardTex.devVp';
      break;
  }
  return gt(marker(key));
}

export const DEV_PALETTE: TexturePalette = {
  accent: '#7a2e3a',
  accentDark: '#3d1320',
  accentLight: '#d49aa6',
};
