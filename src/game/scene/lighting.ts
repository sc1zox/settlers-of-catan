import { AmbientLight, DirectionalLight, HemisphereLight, Scene } from 'three';

export function addLighting(scene: Scene): void {
  // Soft sky/ground hemisphere fill — gives low-poly a friendly outdoor feel.
  const hemi = new HemisphereLight(0xbfd9ff, 0x4a6b3c, 0.6);
  scene.add(hemi);

  // Warm sun.
  const sun = new DirectionalLight(0xfff2cc, 1.1);
  sun.position.set(14, 24, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 90;
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 24;
  sun.shadow.camera.bottom = -24;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  // A tiny ambient kicker so the unlit sides of low-poly meshes don't go pitch black.
  scene.add(new AmbientLight(0xffffff, 0.15));
}
