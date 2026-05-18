import { Color, Material } from 'three';

const MUTED_TINT = new Color(0.38, 0.4, 0.44);
const MUTE_BLEND = 0.68;

interface StoredMaterialState {
  baseColor: Color;
  baseOpacity: number;
  baseEmissiveIntensity: number | null;
}

export class PresenceMaterialDimmer {
  private readonly states = new Map<Material, StoredMaterialState>();
  private dimmed = false;

  public register(materials: readonly Material[]): void {
    for (let i = 0; i < materials.length; i += 1) {
      this.captureIfNeeded(materials[i]);
    }
  }

  /**
   * Re-snapshot the resting material appearance after dynamic tweaks (e.g. webcam
   * gamma on the avatar screen, self-seat felt highlight). Call only while
   * undimmed so reconnect restores the latest colors instead of stale bases.
   */
  public refreshBases(materials: readonly Material[]): void {
    if (this.dimmed) {
      return;
    }
    for (let i = 0; i < materials.length; i += 1) {
      this.refreshBase(materials[i]);
    }
  }

  public setDimmed(dimmed: boolean): void {
    if (this.dimmed === dimmed) {
      return;
    }
    this.dimmed = dimmed;
    const entries = Array.from(this.states.entries());
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      this.apply(entry[0], entry[1], dimmed);
    }
  }

  private captureIfNeeded(material: Material): void {
    if (this.states.has(material)) {
      return;
    }
    const snapshot = this.snapshotMaterial(material);
    if (snapshot === null) {
      return;
    }
    this.states.set(material, snapshot);
  }

  private refreshBase(material: Material): void {
    const snapshot = this.snapshotMaterial(material);
    if (snapshot === null) {
      return;
    }
    const stored = this.states.get(material);
    if (stored === undefined) {
      this.states.set(material, snapshot);
      return;
    }
    stored.baseColor.copy(snapshot.baseColor);
    stored.baseOpacity = snapshot.baseOpacity;
    stored.baseEmissiveIntensity = snapshot.baseEmissiveIntensity;
  }

  private snapshotMaterial(material: Material): StoredMaterialState | null {
    if (!('color' in material) || !(material.color instanceof Color)) {
      return null;
    }
    const opacity =
      'opacity' in material && typeof material.opacity === 'number' ? material.opacity : 1;
    let baseEmissiveIntensity: number | null = null;
    if ('emissiveIntensity' in material && typeof material.emissiveIntensity === 'number') {
      baseEmissiveIntensity = material.emissiveIntensity;
    }
    return {
      baseColor: material.color.clone(),
      baseOpacity: opacity,
      baseEmissiveIntensity,
    };
  }

  private apply(material: Material, stored: StoredMaterialState, dimmed: boolean): void {
    if (!('color' in material) || !(material.color instanceof Color)) {
      return;
    }
    if (dimmed) {
      material.color.copy(stored.baseColor).lerp(MUTED_TINT, MUTE_BLEND);
      if ('opacity' in material && typeof material.opacity === 'number') {
        material.opacity = stored.baseOpacity * 0.72;
      }
      if ('emissiveIntensity' in material && typeof material.emissiveIntensity === 'number') {
        material.emissiveIntensity = 0;
      }
    } else {
      material.color.copy(stored.baseColor);
      if ('opacity' in material && typeof material.opacity === 'number') {
        material.opacity = stored.baseOpacity;
      }
      if (
        stored.baseEmissiveIntensity !== null &&
        'emissiveIntensity' in material &&
        typeof material.emissiveIntensity === 'number'
      ) {
        material.emissiveIntensity = stored.baseEmissiveIntensity;
      }
    }
    material.needsUpdate = true;
  }
}
