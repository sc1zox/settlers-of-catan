import {
  BoxGeometry,
  Color,
  ConeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';

export interface PlayerFigureMaterials {
  /** Main coloured material for walls / road bodies. */
  readonly body: MeshStandardMaterial;
  /** Slightly darker version for roofs / accents. */
  readonly accent: MeshStandardMaterial;
}

/** Build shared materials per player so 24 figures use only 2 materials each. */
export function createFigureMaterials(color: number): PlayerFigureMaterials {
  const body = new MeshStandardMaterial({ color, flatShading: true, roughness: 0.6 });
  const accentColor = new Color(color).multiplyScalar(0.7);
  const accent = new MeshStandardMaterial({
    color: accentColor,
    flatShading: true,
    roughness: 0.6,
  });
  return { body, accent };
}

export function disposeFigureMaterials(mats: PlayerFigureMaterials): void {
  mats.body.dispose();
  mats.accent.dispose();
}

/** A flat rectangular road token laid on the table. */
export function makeRoad(mats: PlayerFigureMaterials): Group {
  const group = new Group();
  const bar = new Mesh(new BoxGeometry(0.55, 0.09, 0.18), mats.body);
  bar.position.y = 0.045;
  bar.castShadow = true;
  group.add(bar);
  return group;
}

/** Small house with a pyramid roof. */
export function makeSettlement(mats: PlayerFigureMaterials): Group {
  const group = new Group();
  const base = new Mesh(new BoxGeometry(0.32, 0.22, 0.32), mats.body);
  base.position.y = 0.11;
  base.castShadow = true;
  group.add(base);

  const roof = new Mesh(new ConeGeometry(0.26, 0.18, 4), mats.accent);
  roof.position.y = 0.31;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);
  return group;
}

/** Two-part building: main hall + lower annex. */
export function makeCity(mats: PlayerFigureMaterials): Group {
  const group = new Group();

  const main = new Mesh(new BoxGeometry(0.4, 0.3, 0.34), mats.body);
  main.position.set(0.07, 0.15, 0);
  main.castShadow = true;
  group.add(main);
  const mainRoof = new Mesh(new ConeGeometry(0.33, 0.22, 4), mats.accent);
  mainRoof.position.set(0.07, 0.41, 0);
  mainRoof.rotation.y = Math.PI / 4;
  mainRoof.castShadow = true;
  group.add(mainRoof);

  const annex = new Mesh(new BoxGeometry(0.22, 0.2, 0.22), mats.body);
  annex.position.set(-0.21, 0.1, 0.04);
  annex.castShadow = true;
  group.add(annex);
  const annexRoof = new Mesh(new ConeGeometry(0.19, 0.14, 4), mats.accent);
  annexRoof.position.set(-0.21, 0.27, 0.04);
  annexRoof.rotation.y = Math.PI / 4;
  annexRoof.castShadow = true;
  group.add(annexRoof);

  return group;
}
