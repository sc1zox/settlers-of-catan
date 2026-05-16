import { Matrix4, PerspectiveCamera, Quaternion, Vector2, Vector3 } from 'three';
import { Card } from '../cards/card';
import {
  CARD_FACE_TO_CAMERA,
  FOCUS_CENTER_NDC_HAND,
  FOCUS_CENTER_NDC_SINGLE,
  FOCUS_FAN_RADIUS_FACTOR,
  FOCUS_FAN_ROLL_FACTOR,
  FOCUS_FAN_TOTAL_ANGLE_RAD,
  FOCUS_FILL_RATIO_HAND,
  FOCUS_FILL_RATIO_SINGLE,
  FOCUS_GROUP_SPACING_FACTOR,
  FOCUS_HOVER_POP_SIDEWAYS,
  FOCUS_HOVER_POP_UP,
  FOCUS_MIN_DISTANCE,
  FOCUS_NDC_MARGIN,
} from './constants';

export class FocusCardFan {
  private focusedGroup: Card[] = [];

  private readonly camForward = new Vector3();
  private readonly camRight = new Vector3();
  private readonly camUp = new Vector3();
  private readonly worldUp = new Vector3(0, 1, 0);
  private readonly worldTargetPos = new Vector3();
  private readonly worldTargetQuat = new Quaternion();
  private readonly parentInvMatrix = new Matrix4();
  private readonly parentInvQuat = new Quaternion();
  private readonly localTargetPos = new Vector3();
  private readonly localTargetQuat = new Quaternion();
  private readonly fan2D = new Vector2();
  private readonly worldCardQuat = new Quaternion();
  private readonly fanRollQuat = new Quaternion();

  public getFocusedGroup(): readonly Card[] {
    return this.focusedGroup;
  }

  public clearRest(handler: ((focused: boolean) => void) | null): void {
    if (this.focusedGroup.length === 0) {
      return;
    }
    for (let i = 0; i < this.focusedGroup.length; i += 1) {
      this.focusedGroup[i].setMode('rest');
    }
    this.focusedGroup = [];
    handler?.(false);
  }

  public commitFocusedMembers(members: Card[], handler: ((focused: boolean) => void) | null): void {
    for (let i = 0; i < this.focusedGroup.length; i += 1) {
      this.focusedGroup[i].setMode('rest');
    }
    for (let i = 0; i < members.length; i += 1) {
      members[i].setMode('focused');
      members[i].mesh.renderOrder = 999 + i;
    }
    this.focusedGroup = members;
    handler?.(true);
  }

  public update(camera: PerspectiveCamera): void {
    if (this.focusedGroup.length === 0) {
      return;
    }

    camera.getWorldDirection(this.camForward);
    this.camRight.crossVectors(this.camForward, this.worldUp).normalize();
    this.camUp.crossVectors(this.camRight, this.camForward).normalize();

    let maxX = 0;
    let maxZ = 0;
    for (let i = 0; i < this.focusedGroup.length; i += 1) {
      const c = this.focusedGroup[i];
      const s = c.getLocalSize();
      if (s.x > maxX) {
        maxX = s.x;
      }
      if (s.z > maxZ) {
        maxZ = s.z;
      }
    }
    const spacing = maxX * FOCUS_GROUP_SPACING_FACTOR;
    const singleCardFocused = this.focusedGroup.length === 1;
    const fillRatio = singleCardFocused ? FOCUS_FILL_RATIO_SINGLE : FOCUS_FILL_RATIO_HAND;
    const centerNdcY = singleCardFocused ? FOCUS_CENTER_NDC_SINGLE : FOCUS_CENTER_NDC_HAND;
    const fanRadius = singleCardFocused
      ? 0
      : Math.max((this.focusedGroup.length - 1) * spacing * FOCUS_FAN_RADIUS_FACTOR, maxX * 0.85);
    const halfFanAngle = singleCardFocused ? 0 : FOCUS_FAN_TOTAL_ANGLE_RAD * 0.5;

    let minX = 0;
    let maxXOffset = 0;
    for (let i = 0; i < this.focusedGroup.length; i += 1) {
      const half = (this.focusedGroup.length - 1) / 2;
      const normalized = half === 0 ? 0 : (i - half) / half;
      const angle = normalized * halfFanAngle;
      const xOffset = Math.sin(angle) * fanRadius;
      if (i === 0 || xOffset < minX) {
        minX = xOffset;
      }
      if (i === 0 || xOffset > maxXOffset) {
        maxXOffset = xOffset;
      }
    }
    const span = maxX + (maxXOffset - minX);

    const halfTan = Math.tan((camera.fov * Math.PI) / 360);
    const aspect = camera.aspect;
    const usableHalfNdcX = (1 - FOCUS_NDC_MARGIN) * fillRatio;
    const usableHalfNdcY = (1 - FOCUS_NDC_MARGIN - Math.abs(centerNdcY)) * fillRatio;
    const safeHalfNdcX = Math.max(usableHalfNdcX, 0.05);
    const safeHalfNdcY = Math.max(usableHalfNdcY, 0.05);
    const effectiveHeight = maxZ + FOCUS_HOVER_POP_UP * 2;
    const distanceForHeight = effectiveHeight / (2 * halfTan * safeHalfNdcY);
    const distanceForWidth = span / (2 * halfTan * aspect * safeHalfNdcX);
    const distance = Math.max(distanceForHeight, distanceForWidth, FOCUS_MIN_DISTANCE);
    const verticalBias = centerNdcY * halfTan * distance;

    this.worldTargetQuat.copy(camera.quaternion).multiply(CARD_FACE_TO_CAMERA);

    const half = (this.focusedGroup.length - 1) / 2;
    for (let i = 0; i < this.focusedGroup.length; i += 1) {
      const card = this.focusedGroup[i];
      const parent = card.mesh.parent;
      if (!parent) {
        continue;
      }

      const normalized = half === 0 ? 0 : (i - half) / half;
      const angle = normalized * halfFanAngle;
      this.fan2D.set(Math.sin(angle) * fanRadius, 0);
      this.worldTargetPos
        .copy(this.camForward)
        .multiplyScalar(distance)
        .add(camera.position)
        .addScaledVector(this.camRight, this.fan2D.x)
        .addScaledVector(this.camUp, verticalBias + this.fan2D.y);

      const hoverableInHand = card.getHoverInfo() !== null;
      if (card.isHovered() && hoverableInHand && !singleCardFocused) {
        const sideFactor = Math.abs(normalized);
        const sideSign = normalized < 0 ? -1 : 1;
        const upFactor = 1 - sideFactor;
        this.worldTargetPos
          .addScaledVector(this.camRight, sideSign * FOCUS_HOVER_POP_SIDEWAYS * sideFactor)
          .addScaledVector(this.camUp, FOCUS_HOVER_POP_UP * (0.45 + upFactor));
      }

      parent.updateWorldMatrix(true, false);
      this.parentInvMatrix.copy(parent.matrixWorld).invert();
      this.localTargetPos.copy(this.worldTargetPos).applyMatrix4(this.parentInvMatrix);

      parent.getWorldQuaternion(this.parentInvQuat).invert();
      this.fanRollQuat.setFromAxisAngle(
        this.camForward,
        -normalized * halfFanAngle * FOCUS_FAN_ROLL_FACTOR,
      );
      this.worldCardQuat.copy(this.worldTargetQuat).multiply(this.fanRollQuat);
      this.localTargetQuat.copy(this.parentInvQuat).multiply(this.worldCardQuat);

      card.setLiveTarget(this.localTargetPos, this.localTargetQuat);
    }
  }
}
