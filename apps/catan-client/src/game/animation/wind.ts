import { InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';

/**
 * Per-instance parameters needed to sway an InstancedMesh in the wind.
 * Each instance keeps its base transform plus a random phase so the swarm
 * doesn't sway in unison.
 */
export interface SwayInstance {
  readonly basePosition: Vector3;
  readonly baseScale: Vector3;
  readonly baseYaw: number;
  readonly phase: number;
  /** Multiplier on this instance's sway amplitude — used to boost on settled tiles. */
  readonly intensity: number;
}

export interface SwayParams {
  /** Base tilt at full strength, radians. */
  readonly amplitude: number;
  /** Sway frequency, cycles/second. */
  readonly frequency: number;
}

const X_AXIS = new Vector3(1, 0, 0);
const Y_AXIS = new Vector3(0, 1, 0);
const TMP_TILT = new Quaternion();
const TMP_YAW = new Quaternion();
const TMP_QUAT = new Quaternion();
const TMP_MAT = new Matrix4();
const TMP_SCALE = new Vector3();

/** Updates each instance with a sine-wave tilt around X. Call once per frame. */
export function applySway(
  mesh: InstancedMesh,
  instances: readonly SwayInstance[],
  t: number,
  params: SwayParams,
): void {
  const omega = params.frequency * Math.PI * 2;
  for (let i = 0; i < instances.length; i++) {
    const inst = instances[i];
    const tilt = Math.sin(t * omega + inst.phase) * params.amplitude * inst.intensity;
    TMP_TILT.setFromAxisAngle(X_AXIS, tilt);
    TMP_YAW.setFromAxisAngle(Y_AXIS, inst.baseYaw);
    TMP_QUAT.multiplyQuaternions(TMP_YAW, TMP_TILT);
    TMP_SCALE.copy(inst.baseScale);
    TMP_MAT.compose(inst.basePosition, TMP_QUAT, TMP_SCALE);
    mesh.setMatrixAt(i, TMP_MAT);
  }
  mesh.instanceMatrix.needsUpdate = true;
}
