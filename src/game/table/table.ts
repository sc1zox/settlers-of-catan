import {
  AdditiveBlending,
  BoxGeometry,
  CircleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
} from 'three';

export interface TableOptions {
  /** Square tabletop side length. */
  readonly size: number;
  /** World Y of the top surface of the tabletop. */
  readonly topY: number;
  /** Radius of the warm glow disk drawn on the tabletop under the floating island. */
  readonly glowRadius: number;
}

/**
 * Big wooden table the disc hovers over. Adds a soft warm glow disk on top of
 * the surface (natural colour, not cyan) so the floating Catan disc reads as a
 * projected mini-world.
 */
export class Table {
  readonly group: Group = new Group();

  constructor(options: TableOptions) {
    const thickness = 0.7;
    const surface = new Mesh(
      new BoxGeometry(options.size, thickness, options.size),
      new MeshStandardMaterial({
        color: 0x5e3d22,
        roughness: 0.88,
        metalness: 0.0,
        flatShading: true,
      }),
    );
    surface.position.y = options.topY - thickness / 2;
    surface.receiveShadow = true;
    this.group.add(surface);

    const legGeom = new BoxGeometry(0.7, 7, 0.7);
    const legMat = new MeshStandardMaterial({ color: 0x3a2410, flatShading: true });
    const legInset = 0.9;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new Mesh(legGeom, legMat);
        leg.position.set(
          sx * (options.size / 2 - legInset),
          options.topY - thickness - 3.5,
          sz * (options.size / 2 - legInset),
        );
        leg.castShadow = true;
        this.group.add(leg);
      }
    }

    // Warm glow disk on the tabletop directly under the disc — sells the
    // "projected mini-world" without any cyan hologram cliche.
    const glow = new Mesh(
      new CircleGeometry(options.glowRadius, 96),
      new MeshBasicMaterial({
        color: 0xffd896,
        transparent: true,
        opacity: 0.55,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = options.topY + 0.02;
    this.group.add(glow);

    // Soft bottom-up fill light to make the disc underside readable.
    const fill = new PointLight(0xffd29a, 0.7, options.glowRadius * 1.8, 1.5);
    fill.position.set(0, options.topY + 0.5, 0);
    this.group.add(fill);
  }

  dispose(): void {
    this.group.traverse((obj) => {
      if (obj instanceof Mesh) {
        obj.geometry.dispose();
        const list = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of list) m.dispose();
      }
    });
  }
}
