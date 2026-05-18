import {
  BoxGeometry,
  MeshStandardMaterial,
  Mesh,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Vector3,
} from 'three';
import { PlayerSeat, ResourceType } from '@catan/api-interfaces';
import {
  makeResourceFaceTexture,
  makeResourceBackTexture,
  ResourceKind,
} from '../cards/textures';
import { CARD_LONG, CARD_SHORT, CARD_THICKNESS } from '../players/player-area-constants';
import type { PlayerArea } from '../players/player-area';
import { CARD_FACE_TO_CAMERA, RESOURCE_TYPE_TO_KIND } from './constants';

/** Duration each card spends in flight. */
const CARD_FLIGHT_DURATION_S = 1.6;
/** Stagger between successive cards so they ribbon rather than clump. */
const CARD_STAGGER_S = 0.09;
/** Bezier control-point lift above the midpoint between giver and receiver. */
const ARC_APEX_HEIGHT = 4.2;
/** Scale relative to in-hand resource cards. */
const FLIGHT_CARD_SCALE = 0.9;

interface FlightCard {
  readonly mesh: Mesh;
  readonly start: Vector3;
  readonly end: Vector3;
  readonly control: Vector3;
  readonly delayS: number;
  elapsed: number;
}

interface FlightMaterials {
  readonly face: MeshStandardMaterial;
  readonly back: MeshStandardMaterial;
  readonly edge: MeshStandardMaterial;
}

/**
 * One-shot "cards fly between two seats" animation triggered when a trade is
 * finalised. Visible to every viewer regardless of perspective — gives the
 * whole lobby an unmistakable visual that the swap actually happened.
 *
 * Cards spawn at the giver's hand row, arc in a quadratic Bezier curve over
 * the table billboarded toward the camera, fade out near the recipient's hand
 * row, then dispose. {@link BonusAwardFlight} is the pose-driving cousin that
 * borrows hand-owned meshes; this one owns its meshes outright and recycles
 * shared geometry + per-resource material pools across flights.
 */
export class TradeSwapFlight {
  private readonly flights: FlightCard[] = [];
  private readonly liveMeshes = new Set<Mesh>();

  private readonly geometry = new BoxGeometry(
    CARD_SHORT * FLIGHT_CARD_SCALE,
    CARD_THICKNESS * FLIGHT_CARD_SCALE,
    CARD_LONG * FLIGHT_CARD_SCALE,
  );

  /** Pooled per-resource face/back/edge materials — textures aren't cheap. */
  private readonly materialsByKind = new Map<ResourceKind, FlightMaterials>();

  private readonly tmpFromAnchor = new Vector3();
  private readonly tmpToAnchor = new Vector3();
  private readonly tmpPos = new Vector3();
  private readonly tmpFaceQuat = new Quaternion();

  public constructor(private readonly scene: Scene) {}

  public start(
    fromSeat: PlayerSeat,
    toSeat: PlayerSeat,
    give: Readonly<Partial<Record<ResourceType, number>>>,
    take: Readonly<Partial<Record<ResourceType, number>>>,
    players: readonly PlayerArea[],
  ): void {
    const fromArea = players[fromSeat];
    const toArea = players[toSeat];
    if (!fromArea || !toArea) {
      return;
    }
    fromArea.getHandRowWorldPosition(this.tmpFromAnchor);
    toArea.getHandRowWorldPosition(this.tmpToAnchor);
    this.enqueueCardsForResources(give, this.tmpFromAnchor, this.tmpToAnchor);
    this.enqueueCardsForResources(take, this.tmpToAnchor, this.tmpFromAnchor);
  }

  public update(dt: number, camera: PerspectiveCamera): void {
    if (this.flights.length === 0) {
      return;
    }
    this.tmpFaceQuat.copy(camera.quaternion).multiply(CARD_FACE_TO_CAMERA);

    for (let i = this.flights.length - 1; i >= 0; i -= 1) {
      const flight = this.flights[i];
      flight.elapsed += dt;
      const localT = flight.elapsed - flight.delayS;
      if (localT < 0) {
        flight.mesh.visible = false;
        continue;
      }
      const tNorm = localT / CARD_FLIGHT_DURATION_S;
      if (tNorm >= 1) {
        this.releaseMesh(flight.mesh);
        this.flights.splice(i, 1);
        continue;
      }
      flight.mesh.visible = true;
      this.evaluateBezier(flight, tNorm, this.tmpPos);
      flight.mesh.position.copy(this.tmpPos);
      flight.mesh.quaternion.copy(this.tmpFaceQuat);
      // Soft fade-in (first 12 %) and fade-out (last 20 %).
      const fade =
        tNorm < 0.12 ? tNorm / 0.12 : tNorm > 0.8 ? 1 - (tNorm - 0.8) / 0.2 : 1;
      this.applyOpacity(flight.mesh, fade);
    }
  }

  public clearAll(): void {
    for (const mesh of this.liveMeshes) {
      this.scene.remove(mesh);
    }
    this.liveMeshes.clear();
    this.flights.length = 0;
  }

  public dispose(): void {
    this.clearAll();
    this.geometry.dispose();
    for (const mats of this.materialsByKind.values()) {
      mats.face.map?.dispose();
      mats.face.dispose();
      mats.back.map?.dispose();
      mats.back.dispose();
      mats.edge.dispose();
    }
    this.materialsByKind.clear();
  }

  private enqueueCardsForResources(
    counts: Readonly<Partial<Record<ResourceType, number>>>,
    spawnAnchor: Vector3,
    arrivalAnchor: Vector3,
  ): void {
    const keys = Object.keys(counts) as ResourceType[];
    let cardIndex = 0;
    for (let k = 0; k < keys.length; k += 1) {
      const resource = keys[k];
      const amount = counts[resource] ?? 0;
      const kind = RESOURCE_TYPE_TO_KIND[resource];
      for (let c = 0; c < amount; c += 1) {
        const mats = this.requireMaterials(kind);
        const mesh = this.spawnMesh(mats);
        // Per-card lateral jitter so a stream of cards reads as a ribbon
        // rather than a single mesh blinking along the same line.
        const jitterX = (Math.random() - 0.5) * 0.6;
        const jitterZ = (Math.random() - 0.5) * 0.6;
        const start = spawnAnchor.clone().add(new Vector3(jitterX, 0, jitterZ));
        const end = arrivalAnchor.clone().add(
          new Vector3(jitterX * 0.5, 0, jitterZ * 0.5),
        );
        const control = this.buildArcControlPoint(start, end);
        control.x += (Math.random() - 0.5) * 1.4;
        control.z += (Math.random() - 0.5) * 1.4;
        this.flights.push({
          mesh,
          start,
          end,
          control,
          delayS: cardIndex * CARD_STAGGER_S,
          elapsed: 0,
        });
        cardIndex += 1;
      }
    }
  }

  private spawnMesh(mats: FlightMaterials): Mesh {
    const mesh = new Mesh(this.geometry, [
      mats.edge,
      mats.edge,
      mats.back,
      mats.face,
      mats.edge,
      mats.edge,
    ]);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = 1400;
    mesh.visible = false;
    this.scene.add(mesh);
    this.liveMeshes.add(mesh);
    return mesh;
  }

  private releaseMesh(mesh: Mesh): void {
    this.scene.remove(mesh);
    this.liveMeshes.delete(mesh);
  }

  private requireMaterials(kind: ResourceKind): FlightMaterials {
    const existing = this.materialsByKind.get(kind);
    if (existing) {
      return existing;
    }
    const face = new MeshStandardMaterial({
      map: makeResourceFaceTexture(kind),
      transparent: true,
      depthWrite: false,
      roughness: 0.85,
    });
    const back = new MeshStandardMaterial({
      map: makeResourceBackTexture(),
      transparent: true,
      depthWrite: false,
      roughness: 0.85,
    });
    const edge = new MeshStandardMaterial({
      color: 0x6b4a26,
      transparent: true,
      depthWrite: false,
    });
    const mats: FlightMaterials = { face, back, edge };
    this.materialsByKind.set(kind, mats);
    return mats;
  }

  private buildArcControlPoint(start: Vector3, end: Vector3): Vector3 {
    return new Vector3()
      .addVectors(start, end)
      .multiplyScalar(0.5)
      .add(new Vector3(0, ARC_APEX_HEIGHT, 0));
  }

  private evaluateBezier(flight: FlightCard, t: number, out: Vector3): Vector3 {
    const eased = easeInOutCubic(t);
    const oneMinus = 1 - eased;
    out.set(0, 0, 0);
    out.addScaledVector(flight.start, oneMinus * oneMinus);
    out.addScaledVector(flight.control, 2 * oneMinus * eased);
    out.addScaledVector(flight.end, eased * eased);
    return out;
  }

  private applyOpacity(mesh: Mesh, opacity: number): void {
    const mats = mesh.material;
    if (Array.isArray(mats)) {
      for (let i = 0; i < mats.length; i += 1) {
        (mats[i] as MeshStandardMaterial).opacity = opacity;
      }
      return;
    }
    (mats as MeshStandardMaterial).opacity = opacity;
  }
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
