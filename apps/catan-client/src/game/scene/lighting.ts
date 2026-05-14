import {
  ACESFilmicToneMapping,
  AmbientLight,
  DirectionalLight,
  HemisphereLight,
  PMREMGenerator,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** Direction the warm key light ("sun") shines onto the table from. */
const SUN_POSITION = new Vector3(14, 24, 10);

/**
 * Lighting rig: a warm directional key light standing in for the sun, soft
 * sky/ground fill, and an image-based environment so every PBR surface picks
 * up gentle, direction-aware bounce light. Filmic tone mapping ties it
 * together — the scene reads as sunlit and lively rather than flat and dark,
 * while staying subtle.
 */
export function addLighting(scene: Scene, renderer: WebGLRenderer): void {
  // Filmic tone mapping rolls highlights off gently, so the light reads as
  // natural daylight instead of a flat wash.
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // Image-based ambient: a neutral room env map gives PBR surfaces soft,
  // direction-aware fill — the "ray-traced" softness, kept deliberately low.
  const pmrem = new PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  scene.environment = pmrem.fromScene(roomEnv, 0.04).texture;
  scene.environmentIntensity = 0.4;
  roomEnv.dispose();
  pmrem.dispose();

  // Soft sky/ground hemisphere fill — lifts the low-poly shadow sides.
  const hemi = new HemisphereLight(0xcfe6ff, 0x55703f, 0.75);
  scene.add(hemi);

  // Warm key sun shining onto the table, with soft contact shadows.
  const sun = new DirectionalLight(0xfff1cf, 1.6);
  sun.position.copy(SUN_POSITION);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 110;
  sun.shadow.camera.left = -28;
  sun.shadow.camera.right = 28;
  sun.shadow.camera.top = 28;
  sun.shadow.camera.bottom = -28;
  sun.shadow.bias = -0.0005;
  sun.shadow.radius = 4;
  scene.add(sun);

  // Gentle ambient floor so unlit faces never crush to pure black.
  scene.add(new AmbientLight(0xffffff, 0.2));
}
