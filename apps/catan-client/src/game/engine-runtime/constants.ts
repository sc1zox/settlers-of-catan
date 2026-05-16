import { Vector3, Quaternion } from 'three';
import { HEX_SIZE } from '../board/hex';
import { ResourceKind } from '../cards/textures';
import { ResourceType } from '@catan/api-interfaces';

export const TABLE_TOP_Y = -3.5;
export const TABLE_SIZE = 44;
export const INNER_STRIP_Z = 17.2;
export const OUTER_STRIP_Z = 21.4;

export const CARD_FACE_TO_CAMERA = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);

export const FOCUS_FILL_RATIO_HAND = 0.52;
export const FOCUS_FILL_RATIO_SINGLE = 0.9;
export const FOCUS_GROUP_SPACING_FACTOR = 0.38;
export const FOCUS_MIN_DISTANCE = 0.9;
export const FOCUS_NDC_MARGIN = 0.08;
export const FOCUS_CENTER_NDC_HAND = -0.32;
export const FOCUS_CENTER_NDC_SINGLE = 0;
export const FOCUS_FAN_TOTAL_ANGLE_RAD = Math.PI * 0.34;
export const FOCUS_FAN_RADIUS_FACTOR = 1.1;
export const FOCUS_FAN_ROLL_FACTOR = 0.35;
export const FOCUS_HOVER_POP_UP = 0.24;
export const FOCUS_HOVER_POP_SIDEWAYS = 0.34;

export const SPECTATOR_ORBIT_MIN_DISTANCE = 4;
export const SPECTATOR_ORBIT_MAX_DISTANCE = 145;
export const SPECTATOR_ORBIT_MIN_POLAR = 0.04;
export const SPECTATOR_ORBIT_MAX_POLAR = Math.PI * 0.49;

export const TILE_UPDATE_BOUNDS_RADIUS = HEX_SIZE * 1.65;
export const PLAYER_UPDATE_BOUNDS_RADIUS = 9.2;
export const DICE_UPDATE_BOUNDS_RADIUS = 3.6;
export const BOARD_OVERLAY_UPDATE_BOUNDS_RADIUS = HEX_SIZE * 4.9;

export const RESOURCE_TYPE_TO_KIND: Readonly<Record<ResourceType, ResourceKind>> = {
  [ResourceType.Wood]: ResourceKind.Wood,
  [ResourceType.Brick]: ResourceKind.Brick,
  [ResourceType.Wheat]: ResourceKind.Grain,
  [ResourceType.Wool]: ResourceKind.Wool,
  [ResourceType.Ore]: ResourceKind.Ore,
};
