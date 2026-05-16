import { Matrix4, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { BonusAwardKind, PlayerSeat } from '@catan/api-interfaces';
import { Card } from '../cards/card';
import type { PlayerArea } from '../players/player-area';
import {
  CARD_FACE_TO_CAMERA,
  FOCUS_FILL_RATIO_SINGLE,
  FOCUS_MIN_DISTANCE,
  FOCUS_NDC_MARGIN,
} from './constants';

/** Total runtime of a single fly-in, from spawn to back at rest. */
const FLIGHT_DURATION_SECONDS = 2.0;
/** Portion of the duration spent at the spawn pose before easing toward rest. */
const FLIGHT_HOLD_FRACTION = 0.55;
/** Extra height above the recipient's head where the remote-view card hovers. */
const REMOTE_HOVER_HEIGHT = 1.8;
/** Lift toward the camera so the remote-view card doesn't sit flush with the avatar. */
const REMOTE_HOVER_TOWARD_CAMERA = 1.6;

interface BonusFlight {
  readonly card: Card;
  readonly recipientSeat: PlayerSeat;
  readonly kind: BonusAwardKind;
  readonly isSelf: boolean;
  elapsed: number;
}

/**
 * Drives the "appears huge → settles next to the recipient's hand" animation
 * for `Längste Handelsstraße` / `Größte Rittermacht`. The card mesh itself
 * lives on the recipient's {@link PlayerArea}; this class only overrides its
 * pose each frame while the animation is in flight and clears focus mode when
 * the flight ends so the card returns to its base table pose.
 */
export class BonusAwardFlight {
  private readonly flights: BonusFlight[] = [];

  private readonly camForward = new Vector3();
  private readonly camRight = new Vector3();
  private readonly camUp = new Vector3();
  private readonly worldUp = new Vector3(0, 1, 0);
  private readonly worldTargetPos = new Vector3();
  private readonly worldTargetQuat = new Quaternion();
  private readonly localTargetPos = new Vector3();
  private readonly localTargetQuat = new Quaternion();
  private readonly parentInvMatrix = new Matrix4();
  private readonly parentInvQuat = new Quaternion();
  private readonly avatarWorldPos = new Vector3();

  public start(card: Card, kind: BonusAwardKind, recipientSeat: PlayerSeat, isSelf: boolean): void {
    // Replace any existing flight for this seat+kind so a re-emit (e.g. after
    // reconnect) restarts the animation cleanly instead of double-driving.
    for (let i = this.flights.length - 1; i >= 0; i -= 1) {
      const f = this.flights[i];
      if (f.kind === kind && f.recipientSeat === recipientSeat) {
        f.card.setMode('rest');
        this.flights.splice(i, 1);
      }
    }
    // Focus mode disables depth testing + boosts emissive — exactly what we
    // want for a card that needs to read while soaring across the scene.
    card.setMode('focused');
    card.mesh.renderOrder = 1500;
    this.flights.push({ card, kind, recipientSeat, isSelf, elapsed: 0 });
  }

  public update(dt: number, camera: PerspectiveCamera, players: readonly PlayerArea[]): void {
    if (this.flights.length === 0) {
      return;
    }
    camera.getWorldDirection(this.camForward);
    this.camRight.crossVectors(this.camForward, this.worldUp).normalize();
    this.camUp.crossVectors(this.camRight, this.camForward).normalize();

    for (let i = this.flights.length - 1; i >= 0; i -= 1) {
      const flight = this.flights[i];
      flight.elapsed += dt;
      if (flight.elapsed >= FLIGHT_DURATION_SECONDS) {
        // Falling back to 'rest' restores depthTest + the base pose target so
        // Card.update() naturally lerps the mesh into its slot next frame.
        flight.card.setMode('rest');
        this.flights.splice(i, 1);
        continue;
      }
      const blend = this.computeRestBlend(flight.elapsed);
      this.computeSpawnPose(flight, players, camera);
      if (blend <= 0) {
        // Still in the "appears big" hold — drive the card directly from the
        // spawn pose so it doesn't drift toward rest yet.
        this.writeWorldPoseToLiveTarget(flight.card);
      } else {
        // Eased crossfade between spawn pose and the resting base pose.
        this.blendSpawnToRest(flight.card, blend);
      }
    }
  }

  public clearAll(): void {
    for (let i = 0; i < this.flights.length; i += 1) {
      this.flights[i].card.setMode('rest');
    }
    this.flights.length = 0;
  }

  /** Cancel any in-progress flight for this (seat, kind) before the card mesh is disposed. */
  public cancel(kind: BonusAwardKind, recipientSeat: PlayerSeat): void {
    for (let i = this.flights.length - 1; i >= 0; i -= 1) {
      const f = this.flights[i];
      if (f.kind === kind && f.recipientSeat === recipientSeat) {
        this.flights.splice(i, 1);
      }
    }
  }

  private computeRestBlend(elapsed: number): number {
    const holdFor = FLIGHT_DURATION_SECONDS * FLIGHT_HOLD_FRACTION;
    if (elapsed <= holdFor) {
      return 0;
    }
    const transitionLen = FLIGHT_DURATION_SECONDS - holdFor;
    const raw = (elapsed - holdFor) / transitionLen;
    // easeInOutCubic for a soft launch + soft landing on the table.
    return raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
  }

  private computeSpawnPose(
    flight: BonusFlight,
    players: readonly PlayerArea[],
    camera: PerspectiveCamera,
  ): void {
    if (flight.isSelf) {
      this.computeSelfFocusedPose(flight.card, camera);
      return;
    }
    const recipientArea = players[flight.recipientSeat];
    if (!recipientArea) {
      this.computeSelfFocusedPose(flight.card, camera);
      return;
    }
    recipientArea.getAvatarHeadWorldPosition(this.avatarWorldPos);
    // Hover above and slightly toward the camera so all four seats can see the
    // floating card; never put it behind the avatar (away from the table).
    this.worldTargetPos
      .copy(this.avatarWorldPos)
      .addScaledVector(this.worldUp, REMOTE_HOVER_HEIGHT)
      .addScaledVector(this.camForward, -REMOTE_HOVER_TOWARD_CAMERA);
    this.worldTargetQuat.copy(camera.quaternion).multiply(CARD_FACE_TO_CAMERA);
  }

  private computeSelfFocusedPose(card: Card, camera: PerspectiveCamera): void {
    const size = card.getLocalSize();
    const halfTan = Math.tan((camera.fov * Math.PI) / 360);
    const aspect = camera.aspect;
    const usableHalf = (1 - FOCUS_NDC_MARGIN) * FOCUS_FILL_RATIO_SINGLE;
    const safeHalf = Math.max(usableHalf, 0.05);
    const distanceForHeight = size.z / (2 * halfTan * safeHalf);
    const distanceForWidth = size.x / (2 * halfTan * aspect * safeHalf);
    const distance = Math.max(distanceForHeight, distanceForWidth, FOCUS_MIN_DISTANCE);
    this.worldTargetPos.copy(this.camForward).multiplyScalar(distance).add(camera.position);
    this.worldTargetQuat.copy(camera.quaternion).multiply(CARD_FACE_TO_CAMERA);
  }

  private writeWorldPoseToLiveTarget(card: Card): void {
    const parent = card.mesh.parent;
    if (!parent) {
      return;
    }
    parent.updateWorldMatrix(true, false);
    this.parentInvMatrix.copy(parent.matrixWorld).invert();
    this.localTargetPos.copy(this.worldTargetPos).applyMatrix4(this.parentInvMatrix);
    parent.getWorldQuaternion(this.parentInvQuat).invert();
    this.localTargetQuat.copy(this.parentInvQuat).multiply(this.worldTargetQuat);
    card.setLiveTarget(this.localTargetPos, this.localTargetQuat);
  }

  private blendSpawnToRest(card: Card, blend: number): void {
    const parent = card.mesh.parent;
    if (!parent) {
      return;
    }
    parent.updateWorldMatrix(true, false);
    this.parentInvMatrix.copy(parent.matrixWorld).invert();
    this.localTargetPos.copy(this.worldTargetPos).applyMatrix4(this.parentInvMatrix);
    parent.getWorldQuaternion(this.parentInvQuat).invert();
    this.localTargetQuat.copy(this.parentInvQuat).multiply(this.worldTargetQuat);
    const restPos = card.getBasePosition();
    const restQuat = card.getBaseQuaternion();
    this.localTargetPos.lerp(restPos, blend);
    this.localTargetQuat.slerp(restQuat, blend);
    card.setLiveTarget(this.localTargetPos, this.localTargetQuat);
  }
}
