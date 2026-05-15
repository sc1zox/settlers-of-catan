import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';

export interface PlayerFigureMaterials {
  /** Main coloured material for walls / road tops. */
  readonly body: MeshStandardMaterial;
  /** Slightly darker version for roofs and trim. */
  readonly accent: MeshStandardMaterial;
  /** Very dark variant for doors, windows, chimneys, stone foundation. */
  readonly dark: MeshStandardMaterial;
}

/** Build shared materials per player so 24 figures use only 3 materials each. */
export function createFigureMaterials(color: number): PlayerFigureMaterials {
  const body = new MeshStandardMaterial({ color, flatShading: true, roughness: 0.6 });
  const accentColor = new Color(color).multiplyScalar(0.65);
  const accent = new MeshStandardMaterial({
    color: accentColor,
    flatShading: true,
    roughness: 0.65,
  });
  const darkColor = new Color(color).multiplyScalar(0.28);
  const dark = new MeshStandardMaterial({
    color: darkColor,
    flatShading: true,
    roughness: 0.85,
  });
  return { body, accent, dark };
}

export function disposeFigureMaterials(mats: PlayerFigureMaterials): void {
  mats.body.dispose();
  mats.accent.dispose();
  mats.dark.dispose();
}

/**
 * Road token — read as a planked path resting on a stone bed: a darker
 * stone base wider than the plank above it, plus a slim accent stripe
 * running down the centre. The whole group is stretched in X by
 * BoardBuildings to fill an edge; every part scales together so proportions
 * hold at any length.
 */
export function makeRoad(mats: PlayerFigureMaterials): Group {
  const group = new Group();
  // Stone bed — slightly wider than the plank so the road looks framed.
  const base = new Mesh(new BoxGeometry(0.55, 0.05, 0.22), mats.dark);
  base.position.y = 0.025;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);
  // Wooden plank on top — the player's colour.
  const plank = new Mesh(new BoxGeometry(0.53, 0.05, 0.14), mats.body);
  plank.position.y = 0.075;
  plank.castShadow = true;
  plank.receiveShadow = true;
  group.add(plank);
  // Slim accent ridge running along the centre — catches highlights and
  // breaks the flat top.
  const ridge = new Mesh(new BoxGeometry(0.5, 0.02, 0.05), mats.accent);
  ridge.position.y = 0.105;
  ridge.castShadow = false;
  group.add(ridge);
  return group;
}

/**
 * Settlement — pioneer cottage with a stone footing, Tudor-style timber band,
 * eave cornice, pyramidal roof, round chimney offset to one side, plus a door
 * and side windows. The combination of materials (stone base / coloured walls
 * / darker roof / round stone chimney) reads as a small inhabited cottage
 * rather than a clean token.
 */
export function makeSettlement(mats: PlayerFigureMaterials): Group {
  const group = new Group();

  // Stone foundation — slightly wider than the walls so it reads as a footing.
  const foundation = new Mesh(new BoxGeometry(0.36, 0.06, 0.36), mats.dark);
  foundation.position.y = 0.03;
  foundation.castShadow = true;
  foundation.receiveShadow = true;
  group.add(foundation);

  // Walls
  const walls = new Mesh(new BoxGeometry(0.32, 0.2, 0.32), mats.body);
  walls.position.y = 0.16;
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  // Half-timber band — slightly wider than the walls, runs around the middle.
  const timber = new Mesh(new BoxGeometry(0.34, 0.025, 0.34), mats.dark);
  timber.position.y = 0.16;
  group.add(timber);

  // Front door, protruding slightly so it casts a small shadow.
  const door = new Mesh(new BoxGeometry(0.1, 0.14, 0.035), mats.dark);
  door.position.set(0, 0.13, 0.175);
  group.add(door);
  // Doorstep — a light step beneath the door makes it read as inviting.
  const doorstep = new Mesh(new BoxGeometry(0.12, 0.02, 0.06), mats.accent);
  doorstep.position.set(0, 0.07, 0.2);
  group.add(doorstep);

  // One window on each side wall.
  const windowGeom = new BoxGeometry(0.025, 0.07, 0.09);
  for (const wx of [-0.165, 0.165]) {
    const win = new Mesh(windowGeom, mats.dark);
    win.position.set(wx, 0.18, 0);
    group.add(win);
  }

  // Eave cornice — a thin slab that flares above the wall top.
  const eave = new Mesh(new BoxGeometry(0.36, 0.025, 0.36), mats.accent);
  eave.position.y = 0.275;
  eave.castShadow = true;
  group.add(eave);

  // 4-sided pyramidal roof. The eave below it gives the brim feel that breaks
  // the bare-pyramid silhouette typical of board game tokens.
  const roof = new Mesh(new ConeGeometry(0.3, 0.2, 4), mats.accent);
  roof.position.y = 0.385;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);

  // Round chimney offset to one side — six-sided so it reads as cylindrical
  // even with flat shading.
  const chimney = new Mesh(new CylinderGeometry(0.04, 0.045, 0.18, 6), mats.dark);
  chimney.position.set(0.1, 0.42, -0.05);
  chimney.castShadow = true;
  group.add(chimney);
  // Chimney lip / cap.
  const cap = new Mesh(new CylinderGeometry(0.05, 0.05, 0.018, 6), mats.accent);
  cap.position.set(0.1, 0.515, -0.05);
  cap.castShadow = true;
  group.add(cap);

  return group;
}

/**
 * City — a small township: a main hall with timber-banded walls, eave cornice
 * and pyramidal roof, plus a tall round watch-tower topped by a witch-hat cone
 * and a banner in the player's colour. The flag and the witch-hat tower break
 * the "fortified blockhouse" feel of the previous design and read clearly as
 * "a place where someone lives".
 */
export function makeCity(mats: PlayerFigureMaterials): Group {
  const group = new Group();

  // Shared foundation under the entire footprint.
  const foundation = new Mesh(new BoxGeometry(0.62, 0.06, 0.42), mats.dark);
  foundation.position.set(-0.04, 0.03, 0);
  foundation.castShadow = true;
  foundation.receiveShadow = true;
  group.add(foundation);

  // === Main hall ===
  const main = new Mesh(new BoxGeometry(0.36, 0.28, 0.32), mats.body);
  main.position.set(0.08, 0.2, 0);
  main.castShadow = true;
  main.receiveShadow = true;
  group.add(main);

  // Timber band on the main hall.
  const mainTimber = new Mesh(new BoxGeometry(0.38, 0.025, 0.34), mats.dark);
  mainTimber.position.set(0.08, 0.2, 0);
  group.add(mainTimber);

  // Door + doorstep on the main hall.
  const mainDoor = new Mesh(new BoxGeometry(0.1, 0.17, 0.035), mats.dark);
  mainDoor.position.set(0.08, 0.155, 0.175);
  group.add(mainDoor);
  const mainStep = new Mesh(new BoxGeometry(0.14, 0.025, 0.07), mats.accent);
  mainStep.position.set(0.08, 0.075, 0.2);
  group.add(mainStep);

  // Side windows on the main hall.
  const mainWindowGeom = new BoxGeometry(0.025, 0.08, 0.1);
  for (const wx of [-0.1, 0.26]) {
    const win = new Mesh(mainWindowGeom, mats.dark);
    win.position.set(wx, 0.22, 0);
    group.add(win);
  }

  // Eave cornice — flares the main hall just below the roof.
  const mainEave = new Mesh(new BoxGeometry(0.4, 0.028, 0.36), mats.accent);
  mainEave.position.set(0.08, 0.355, 0);
  mainEave.castShadow = true;
  group.add(mainEave);

  // Hipped roof.
  const mainRoof = new Mesh(new ConeGeometry(0.33, 0.22, 4), mats.accent);
  mainRoof.position.set(0.08, 0.48, 0);
  mainRoof.rotation.y = Math.PI / 4;
  mainRoof.castShadow = true;
  group.add(mainRoof);

  // Round chimney on the back-right corner.
  const mainChimney = new Mesh(new CylinderGeometry(0.045, 0.05, 0.22, 6), mats.dark);
  mainChimney.position.set(0.22, 0.51, -0.1);
  mainChimney.castShadow = true;
  group.add(mainChimney);
  const mainChimneyCap = new Mesh(new CylinderGeometry(0.055, 0.055, 0.02, 6), mats.accent);
  mainChimneyCap.position.set(0.22, 0.625, -0.1);
  group.add(mainChimneyCap);

  // === Watch tower ===
  const towerH = 0.5;
  const tower = new Mesh(new CylinderGeometry(0.1, 0.12, towerH, 8), mats.body);
  tower.position.set(-0.24, 0.06 + towerH / 2, 0.04);
  tower.castShadow = true;
  tower.receiveShadow = true;
  group.add(tower);

  // Tower midband — matches the main hall's timber band for visual unity.
  const towerBand = new Mesh(new CylinderGeometry(0.115, 0.115, 0.025, 8), mats.dark);
  towerBand.position.set(-0.24, 0.2, 0.04);
  group.add(towerBand);

  // Slim slit window on the front face.
  const slit = new Mesh(new BoxGeometry(0.02, 0.08, 0.025), mats.dark);
  slit.position.set(-0.24, 0.38, 0.14);
  group.add(slit);

  // Tower cap — wider flat disc the witch-hat sits on.
  const towerCap = new Mesh(new CylinderGeometry(0.135, 0.135, 0.03, 8), mats.accent);
  towerCap.position.set(-0.24, 0.575, 0.04);
  towerCap.castShadow = true;
  group.add(towerCap);

  // Witch-hat roof — the signature "tower" silhouette.
  const witchHat = new Mesh(new ConeGeometry(0.125, 0.2, 8), mats.dark);
  witchHat.position.set(-0.24, 0.69, 0.04);
  witchHat.castShadow = true;
  group.add(witchHat);

  // Flag pole topping the witch-hat.
  const flagpole = new Mesh(new CylinderGeometry(0.007, 0.007, 0.18, 6), mats.dark);
  flagpole.position.set(-0.24, 0.88, 0.04);
  flagpole.castShadow = true;
  group.add(flagpole);

  // Banner — player's body colour so it reads as "their" city from across the
  // table. Thin and offset so it hangs off one side of the pole.
  const banner = new Mesh(new BoxGeometry(0.09, 0.055, 0.004), mats.body);
  banner.position.set(-0.19, 0.91, 0.04);
  banner.castShadow = true;
  group.add(banner);

  return group;
}
