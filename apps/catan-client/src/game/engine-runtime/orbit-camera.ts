import { PerspectiveCamera, Vector3 } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  SPECTATOR_ORBIT_MAX_DISTANCE,
  SPECTATOR_ORBIT_MAX_POLAR,
  SPECTATOR_ORBIT_MIN_DISTANCE,
  SPECTATOR_ORBIT_MIN_POLAR,
} from './constants';

export class OrbitCameraAid {
  private spectatorCameraActive = false;
  private orbitLimitsBackup: {
    minDistance: number;
    maxDistance: number;
    minPolarAngle: number;
    maxPolarAngle: number;
  } | null = null;

  private readonly orbitClampDelta = new Vector3();

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

  public applyMatchStartCameraFraming(camera: PerspectiveCamera, controls: OrbitControls): void {
    controls.target.set(0, 0, 0);
    camera.position.set(0, 38, 46);
    controls.update();
  }

  public clampOrbitTarget(camera: PerspectiveCamera, controls: OrbitControls): void {
    const ORBIT_TARGET_XZ = 9;
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
