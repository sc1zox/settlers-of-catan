import { PerspectiveCamera } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function createCamera(aspect: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(45, aspect, 0.1, 400);
  // Start back enough to see the tabletop edges and the floating disc.
  camera.position.set(0, 26, 30);
  camera.lookAt(0, 0, 0);
  return camera;
}

export function createControls(camera: PerspectiveCamera, dom: HTMLElement): OrbitControls {
  const controls = new OrbitControls(camera, dom);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 12;
  controls.maxDistance = 85;
  // Don't let the user look from below the board.
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.minPolarAngle = 0.1;
  controls.target.set(0, 0, 0);
  return controls;
}
