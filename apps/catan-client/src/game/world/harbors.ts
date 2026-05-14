import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three';
import { AxialCoord, axialToWorld, hexRing } from '../board/hex';
import { ResourceTileType, TileType } from '@catan/shared-game-field';
import { TILE_HEIGHT, WATER_LEVEL_Y } from '../tiles/tile';

export enum HarborKind {
  Generic = 'generic',
  Specific = 'specific',
}

export type HarborResource = ResourceTileType;

export interface HarborInfo {
  readonly id: number;
  readonly kind: HarborKind;
  readonly resource: HarborResource | null;
  readonly ratioFrom: number;
  readonly ratioTo: 1;
}

interface HarborPlacement {
  readonly worldX: number;
  readonly worldZ: number;
  readonly rotationY: number;
  readonly kind: HarborKind;
  readonly resource: HarborResource | null;
}

const HARBOR_FLAG_COLOR: Record<HarborResource | 'generic', number> = {
  [TileType.Forest]: 0x356f37,
  [TileType.Fields]: 0xd9b25c,
  [TileType.Pasture]: 0x95c66f,
  [TileType.Hills]: 0xa05a3a,
  [TileType.Mountains]: 0x6c6f76,
  generic: 0xe8e8ee,
};

const NEIGHBOR_DIRS: readonly AxialCoord[] = Object.freeze([
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
]);

function hexRingOf(c: AxialCoord): number {
  return Math.max(Math.abs(c.q), Math.abs(c.r), Math.abs(c.q + c.r));
}

/**
 * Choose 9 outer edges to host harbours. For each selected land hex pick the
 * outer-neighbour edge whose midpoint is farthest from the origin — that's the
 * radially-most-outward edge, so corner hexes get their harbour at the tip.
 */
function buildPlacements(): HarborPlacement[] {
  const pattern: { kind: HarborKind; resource: HarborResource | null }[] = [
    { kind: HarborKind.Specific, resource: TileType.Forest },
    { kind: HarborKind.Generic, resource: null },
    { kind: HarborKind.Specific, resource: TileType.Fields },
    { kind: HarborKind.Generic, resource: null },
    { kind: HarborKind.Specific, resource: TileType.Pasture },
    { kind: HarborKind.Generic, resource: null },
    { kind: HarborKind.Specific, resource: TileType.Hills },
    { kind: HarborKind.Generic, resource: null },
    { kind: HarborKind.Specific, resource: TileType.Mountains },
  ];
  const ring2 = hexRing(2);
  // Skip every fourth ring-2 hex (mid-edges between two corners) so the 6
  // corner hexes plus 3 mid-edge hexes give 9 evenly-distributed harbours.
  const HARBOR_HEX_INDICES = [0, 1, 2, 4, 5, 6, 8, 9, 10];
  const placements: HarborPlacement[] = [];
  for (let i = 0; i < HARBOR_HEX_INDICES.length; i++) {
    const landHex = ring2[HARBOR_HEX_INDICES[i]];
    const landWorld = axialToWorld(landHex);
    let bestMid = { x: 0, z: 0, dist: 0, outX: 0, outZ: 0 };
    for (const dir of NEIGHBOR_DIRS) {
      const neighbour: AxialCoord = { q: landHex.q + dir.q, r: landHex.r + dir.r };
      if (hexRingOf(neighbour) !== 3) continue;
      const outerWorld = axialToWorld(neighbour);
      const midX = (landWorld.x + outerWorld.x) / 2;
      const midZ = (landWorld.z + outerWorld.z) / 2;
      const dist = Math.hypot(midX, midZ);
      if (dist > bestMid.dist) {
        const outX = midX - landWorld.x;
        const outZ = midZ - landWorld.z;
        const len = Math.hypot(outX, outZ);
        bestMid = { x: midX, z: midZ, dist, outX: outX / len, outZ: outZ / len };
      }
    }
    if (bestMid.dist === 0) continue;

    // Building sits just past the cliff edge in open water.
    const offset = 0.95;
    const worldX = bestMid.x + bestMid.outX * offset;
    const worldZ = bestMid.z + bestMid.outZ * offset;
    // Face inward (toward land). Local (0,0,-1) under rotation.y = θ →
    // (-sin θ, 0, -cos θ). For inward = (-outward), set sin θ = outX, cos θ = outZ.
    const rotationY = Math.atan2(bestMid.outX, bestMid.outZ);
    placements.push({
      worldX,
      worldZ,
      rotationY,
      kind: pattern[i].kind,
      resource: pattern[i].resource,
    });
  }
  return placements;
}

export class Harbor {
  readonly group: Group = new Group();
  readonly info: HarborInfo;
  readonly pickMesh: Object3D;

  constructor(info: HarborInfo, placement: HarborPlacement) {
    this.info = info;
    this.group.position.set(placement.worldX, 0, placement.worldZ);
    this.group.rotation.y = placement.rotationY;

    const wallMat = new MeshStandardMaterial({ color: 0xc89770, flatShading: true });
    const beamMat = new MeshStandardMaterial({ color: 0x4a2f1a, flatShading: true });
    const roofMat = new MeshStandardMaterial({ color: 0x7a3a25, flatShading: true });
    const accent = HARBOR_FLAG_COLOR[placement.resource ?? 'generic'];
    const flagMat = new MeshStandardMaterial({ color: accent, flatShading: true });

    const buildingW = 0.95;
    const buildingH = 0.95;
    const buildingD = 0.8;
    // Floor sits comfortably above the wavy water surface so waves can't lap it.
    const floorY = 0.25;
    const buildingCenterY = floorY + buildingH / 2;

    // Stilts: 4 thicker posts at the building's corners, dipping under water.
    const stiltTop = floorY;
    const stiltBottom = WATER_LEVEL_Y - 0.25;
    const stiltHeight = stiltTop - stiltBottom;
    const stiltCenterY = (stiltTop + stiltBottom) / 2;
    const stiltOffsetX = buildingW / 2 - 0.08;
    const stiltOffsetZ = buildingD / 2 - 0.08;
    for (const sx of [-stiltOffsetX, stiltOffsetX]) {
      for (const sz of [-stiltOffsetZ, stiltOffsetZ]) {
        const stilt = new Mesh(new CylinderGeometry(0.07, 0.07, stiltHeight, 6), beamMat);
        stilt.position.set(sx, stiltCenterY, sz);
        stilt.castShadow = true;
        this.group.add(stilt);
      }
    }

    // Building body.
    const body = new Mesh(new BoxGeometry(buildingW, buildingH, buildingD), wallMat);
    body.position.set(0, buildingCenterY, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);

    // Wooden ramp/walkway connecting the door area to the cliff edge.
    // Harbor sits 0.95 outside the cliff midpoint, so the cliff is at local
    // z ≈ -0.95. Ramp climbs from the door (floor height) up to the land top.
    const rampStart = new Vector3(0, floorY + 0.04, -buildingD / 2 + 0.01);
    // End the ramp slightly inside the cliff-top so it visually rests on land.
    const rampEnd = new Vector3(0, TILE_HEIGHT + 0.03, -1.05);
    const rampDir = rampEnd.clone().sub(rampStart);
    const rampLen = rampDir.length();
    const rampCenter = rampStart.clone().add(rampEnd).multiplyScalar(0.5);
    const ramp = new Mesh(
      new BoxGeometry(0.55, 0.08, rampLen),
      new MeshStandardMaterial({ color: 0x9a6c41, flatShading: true }),
    );
    ramp.position.copy(rampCenter);
    ramp.lookAt(rampEnd);
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    this.group.add(ramp);

    // Cross-planks across the ramp give it that boardwalk look.
    const plankCount = 5;
    for (let p = 0; p < plankCount; p++) {
      const t = (p + 0.5) / plankCount;
      const planks = new Mesh(
        new BoxGeometry(0.6, 0.04, 0.07),
        new MeshStandardMaterial({ color: 0x6f4727, flatShading: true }),
      );
      const px = rampStart.x + (rampEnd.x - rampStart.x) * t;
      const py = rampStart.y + (rampEnd.y - rampStart.y) * t + 0.06;
      const pz = rampStart.z + (rampEnd.z - rampStart.z) * t;
      planks.position.set(px, py, pz);
      planks.lookAt(rampEnd);
      this.group.add(planks);
    }

    // Door on the landward side (-Z local).
    const door = new Mesh(new BoxGeometry(0.26, 0.5, 0.02), beamMat);
    door.position.set(0, floorY + 0.25, -buildingD / 2 - 0.01);
    this.group.add(door);

    // Two small windows flanking the door for a bit of life.
    const windowMat = new MeshStandardMaterial({
      color: 0xf4d27a,
      emissive: 0xb87a25,
      emissiveIntensity: 0.4,
      flatShading: true,
    });
    for (const wx of [-0.3, 0.3]) {
      const win = new Mesh(new BoxGeometry(0.16, 0.16, 0.02), windowMat);
      win.position.set(wx, floorY + buildingH - 0.3, -buildingD / 2 - 0.01);
      this.group.add(win);
    }

    // Pyramidal roof (4-sided cone, rotated 45° so the base square aligns).
    const roofH = 0.45;
    const roof = new Mesh(new ConeGeometry(0.78, roofH, 4), roofMat);
    roof.position.set(0, floorY + buildingH + roofH / 2, 0);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    this.group.add(roof);

    // Flag pole rising from the roof apex.
    const poleH = 0.85;
    const poleBaseY = floorY + buildingH + roofH;
    const pole = new Mesh(new CylinderGeometry(0.03, 0.03, poleH, 6), beamMat);
    pole.position.set(0, poleBaseY + poleH / 2, 0);
    pole.castShadow = true;
    this.group.add(pole);
    const flagY = poleBaseY + poleH - 0.16;
    const flag = new Mesh(new BoxGeometry(0.42, 0.24, 0.02), flagMat);
    flag.position.set(0.22, flagY, 0);
    flag.castShadow = true;
    this.group.add(flag);
    if (info.kind === HarborKind.Generic) {
      const mark = new Mesh(
        new BoxGeometry(0.18, 0.18, 0.025),
        new MeshStandardMaterial({ color: 0x222222 }),
      );
      mark.position.set(0.22, flagY, 0.015);
      this.group.add(mark);
    }

    // Invisible pick volume covering the whole harbour.
    const pickGeom = new BoxGeometry(
      buildingW + 0.4,
      buildingH + roofH + poleH + 0.4,
      buildingD + 0.4,
    );
    const pickMat = new MeshStandardMaterial({ visible: false });
    const pick = new Mesh(pickGeom, pickMat);
    pick.position.set(0, buildingCenterY + 0.3, 0);
    pick.userData['kind'] = 'harbor';
    pick.userData['harbor'] = this;
    this.group.add(pick);
    this.pickMesh = pick;
  }
}

export interface HarborSystem {
  readonly group: Group;
  readonly harbors: readonly Harbor[];
}

export function createHarbors(): HarborSystem {
  const group = new Group();
  const placements = buildPlacements();
  const harbors: Harbor[] = placements.map((placement, i) => {
    const info: HarborInfo = {
      id: i,
      kind: placement.kind,
      resource: placement.resource,
      ratioFrom: placement.kind === HarborKind.Specific ? 2 : 3,
      ratioTo: 1,
    };
    const harbor = new Harbor(info, placement);
    group.add(harbor.group);
    return harbor;
  });
  return { group, harbors };
}
