import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';

export interface RobberKnightMount {
  readonly root: Group;
  dispose(): void;
}

function pushMat(
  bucket: MeshStandardMaterial[],
  color: number,
  metalness: number,
): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: 0.52,
    metalness,
  });
  bucket.push(m);
  return m;
}

export function createRobberKnightMount(): RobberKnightMount {
  const root = new Group();
  root.rotation.y = Math.PI * 0.22;
  const materials: MeshStandardMaterial[] = [];

  const horseCoat = pushMat(materials, 0x5c4033, 0.05);
  const horseDark = pushMat(materials, 0x3d2a22, 0.04);
  const armor = pushMat(materials, 0x8a96a0, 0.42);
  const armorDark = pushMat(materials, 0x5d6670, 0.4);
  const cloth = pushMat(materials, 0x6b2828, 0.02);
  const wood = pushMat(materials, 0x4f3f2a, 0.02);
  const steel = pushMat(materials, 0xb8c4cc, 0.55);

  function addMesh(mesh: Mesh): void {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  const legX = 0.17;
  const legZ = 0.22;
  const legH = 0.22;
  const legY = legH * 0.5;
  for (let i = 0; i < 4; i += 1) {
    const lx = i < 2 ? -legX : legX;
    const lz = i % 2 === 0 ? -legZ : legZ;
    const leg = new Mesh(new CylinderGeometry(0.052, 0.058, legH, 6), horseDark);
    leg.position.set(lx, legY, lz);
    addMesh(leg);
  }

  const body = new Mesh(new BoxGeometry(0.48, 0.24, 0.56), horseCoat);
  body.position.set(0, 0.3, 0);
  addMesh(body);

  const neck = new Mesh(new BoxGeometry(0.18, 0.22, 0.24), horseCoat);
  neck.position.set(0.3, 0.42, 0.06);
  neck.rotation.z = -0.42;
  addMesh(neck);

  const head = new Mesh(new BoxGeometry(0.16, 0.18, 0.34), horseDark);
  head.position.set(0.5, 0.46, 0.1);
  addMesh(head);

  const tail = new Mesh(new BoxGeometry(0.09, 0.14, 0.26), horseDark);
  tail.position.set(-0.28, 0.34, -0.26);
  tail.rotation.x = 0.38;
  addMesh(tail);

  const saddle = new Mesh(new BoxGeometry(0.4, 0.07, 0.44), cloth);
  saddle.position.set(0, 0.42, 0);
  addMesh(saddle);

  const rider = new Mesh(new BoxGeometry(0.26, 0.3, 0.22), armor);
  rider.position.set(-0.02, 0.58, -0.05);
  addMesh(rider);

  const helmet = new Mesh(new ConeGeometry(0.13, 0.2, 6), armorDark);
  helmet.position.set(-0.02, 0.8, -0.05);
  helmet.rotation.y = Math.PI / 6;
  addMesh(helmet);

  const lanceWood = new Mesh(new BoxGeometry(0.68, 0.055, 0.055), wood);
  lanceWood.position.set(0.38, 0.66, 0.14);
  lanceWood.rotation.z = Math.PI / 4.2;
  addMesh(lanceWood);

  const lanceTip = new Mesh(new CylinderGeometry(0.04, 0.001, 0.14, 6), steel);
  lanceTip.rotation.z = Math.PI / 2;
  lanceTip.position.set(0.78, 0.82, 0.22);
  addMesh(lanceTip);

  return {
    root,
    dispose(): void {
      root.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
        }
      });
      for (let i = 0; i < materials.length; i += 1) {
        materials[i].dispose();
      }
    },
  };
}
