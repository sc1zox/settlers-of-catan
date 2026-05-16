import { ResourceKind } from '../cards/textures-enums-labels';

export const CARD_LONG = 0.95;
export const CARD_SHORT = 0.65;
export const CARD_THICKNESS = 0.035;
export const HAND_GAP = 0.18;

export const RESOURCE_DISPLAY_ORDER: readonly ResourceKind[] = [
  ResourceKind.Wood,
  ResourceKind.Brick,
  ResourceKind.Grain,
  ResourceKind.Wool,
  ResourceKind.Ore,
];

export const DEAL_DROP_HEIGHT = 1.7;
export const DEAL_LATERAL_JITTER = 0.45;

export const ARSENAL_LIFT_HEIGHT = 1.15;
export const ARSENAL_LIFT_SCALE = 1.3;
export const ARSENAL_BOB_AMPLITUDE = 0.06;
export const ARSENAL_SWAY_ANGLE = 0.16;
export const ARSENAL_FLIGHT_DURATION = 0.6;
export const ARSENAL_FLIGHT_ARC = 1.4;
