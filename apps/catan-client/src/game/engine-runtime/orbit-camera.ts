import { PerspectiveCamera, Vector3 } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { PlayerSeat } from '@catan/api-interfaces';
import {
  SPECTATOR_ORBIT_MAX_DISTANCE,
  SPECTATOR_ORBIT_MAX_POLAR,
  SPECTATOR_ORBIT_MIN_DISTANCE,
  SPECTATOR_ORBIT_MIN_POLAR,
} from './constants';

export class OrbitCameraAid {
  private static readonly MATCH_START_CAMERA_X = 0;
  private static readonly MATCH_START_CAMERA_Y = 38;
  private static readonly MATCH_START_CAMERA_Z = 46;

  private spectatorCameraActive = false;
  private orbitLimitsBackup: {
    minDistance: number;
    maxDistance: number;
    minPolarAngle: number;
    maxPolarAngle: number;
  } | null = null;

  private readonly orbitClampDelta = new Vector3();
  private readonly matchStartCameraPosition = new Vector3();
  private readonly worldUpAxis = new Vector3(0, 1, 0);

  public isSpectatorActive(): boolean {
    return this.spectatorCameraActive;
  }

  public setSpectatorCameraMode(active: boolean, controls: OrbitControls): void {
    if (active === this.spectatorCameraActive) {
      return;
    }
    if (active) {
      if (this.orbitLimitsBackup === null) {
        this.orbitLimitsBackup = {
          minDistance: controls.minDistance,
          maxDistance: controls.maxDistance,
          minPolarAngle: controls.minPolarAngle,
          maxPolarAngle: controls.maxPolarAngle,
        };
      }
      controls.minDistance = SPECTATOR_ORBIT_MIN_DISTANCE;
      controls.maxDistance = SPECTATOR_ORBIT_MAX_DISTANCE;
      controls.minPolarAngle = SPECTATOR_ORBIT_MIN_POLAR;
      controls.maxPolarAngle = SPECTATOR_ORBIT_MAX_POLAR;
      this.spectatorCameraActive = true;
    } else {
      if (this.orbitLimitsBackup !== null) {
        controls.minDistance = this.orbitLimitsBackup.minDistance;
        controls.maxDistance = this.orbitLimitsBackup.maxDistance;
        controls.minPolarAngle = this.orbitLimitsBackup.minPolarAngle;
        controls.maxPolarAngle = this.orbitLimitsBackup.maxPolarAngle;
        this.orbitLimitsBackup = null;
      }
      this.spectatorCameraActive = false;
    }
  }

  public resetSpectator(controls: OrbitControls): void {
    if (!this.spectatorCameraActive) {
      return;
    }
    if (this.orbitLimitsBackup !== null) {
      controls.minDistance = this.orbitLimitsBackup.minDistance;
      controls.maxDistance = this.orbitLimitsBackup.maxDistance;
      controls.minPolarAngle = this.orbitLimitsBackup.minPolarAngle;
      controls.maxPolarAngle = this.orbitLimitsBackup.maxPolarAngle;
      this.orbitLimitsBackup = null;
    }
    this.spectatorCameraActive = false;
  }

  public applyMatchStartCameraFraming(
    camera: PerspectiveCamera,
    controls: OrbitControls,
    selfSeat: PlayerSeat | null,
  ): void {
    controls.target.set(0, 0, 0);
    this.matchStartCameraPosition.set(
      OrbitCameraAid.MATCH_START_CAMERA_X,
      OrbitCameraAid.MATCH_START_CAMERA_Y,
      OrbitCameraAid.MATCH_START_CAMERA_Z,
    );
    if (selfSeat !== null) {
      this.matchStartCameraPosition.applyAxisAngle(this.worldUpAxis, selfSeat * (Math.PI / 2));
    }
    camera.position.copy(this.matchStartCameraPosition);
    controls.update();
  }

  public clampOrbitTarget(camera: PerspectiveCamera, controls: OrbitControls): void {
    const ORBIT_TARGET_XZ = 26;
    const ORBIT_TARGET_Y_MIN = -2;
    const ORBIT_TARGET_Y_MAX = 8;
    const target = controls.target;
    const x = Math.min(ORBIT_TARGET_XZ, Math.max(-ORBIT_TARGET_XZ, target.x));
    const y = Math.min(ORBIT_TARGET_Y_MAX, Math.max(ORBIT_TARGET_Y_MIN, target.y));
    const z = Math.min(ORBIT_TARGET_XZ, Math.max(-ORBIT_TARGET_XZ, target.z));
    if (x === target.x && y === target.y && z === target.z) {
      return;
    }
    this.orbitClampDelta.set(x - target.x, y - target.y, z - target.z);
    target.set(x, y, z);
    camera.position.add(this.orbitClampDelta);
  }
}
