import { Group, Vector3 } from 'three';
import { PlayerColor } from './colors';
import { AvatarSeat } from './avatar-seat';

export class PlayerAreaAvatar {
  private readonly avatarSeat: AvatarSeat;

  public constructor(
    parent: Group,
    tableTopY: number,
    outerEdgeZ: number,
    color: PlayerColor,
    displayName: string,
  ) {
    this.avatarSeat = new AvatarSeat({
      tableTopY,
      outerEdgeZ,
      bodyColor: color,
    });
    this.avatarSeat.setDisplayName(displayName);
    parent.add(this.avatarSeat.group);
  }

  public setHeadVideo(video: HTMLVideoElement | null, showNoCameraPlaceholder = false): void {
    this.avatarSeat.setVideoElement(video, { placeholderWhenEmpty: showNoCameraPlaceholder });
  }

  public setHeadVideoDisplayGamma(gamma: number): void {
    this.avatarSeat.setVideoDisplayGamma(gamma);
  }

  public setDisplayName(name: string): void {
    this.avatarSeat.setDisplayName(name);
  }

  public setPresenceDimmed(dimmed: boolean): void {
    this.avatarSeat.setPresenceDimmed(dimmed);
  }

  public updateVideoTick(): void {
    this.avatarSeat.update(1 / 60);
  }

  public update(dt: number): void {
    this.avatarSeat.update(dt);
  }

  public getHeadWorldPosition(out: Vector3): Vector3 {
    return this.avatarSeat.getHeadWorldPosition(out);
  }

  public dispose(): void {
    this.avatarSeat.dispose();
  }
}
