export enum PlayerColor {
  Red = 0xc8392c,
  Blue = 0x2a72c8,
  White = 0xeae6e0,
  Orange = 0xe8902c,
}

export const PLAYER_NAME_DE: Record<PlayerColor, string> = {
  [PlayerColor.Red]: 'Rot',
  [PlayerColor.Blue]: 'Blau',
  [PlayerColor.White]: 'Weiß',
  [PlayerColor.Orange]: 'Orange',
};

export const PLAYER_SEAT_ORDER: readonly PlayerColor[] = Object.freeze([
  PlayerColor.Red,
  PlayerColor.Blue,
  PlayerColor.White,
  PlayerColor.Orange,
]);
