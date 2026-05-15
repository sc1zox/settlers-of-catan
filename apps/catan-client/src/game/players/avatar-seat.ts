import { AvatarKind } from '@catan/api-interfaces';
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';

export interface AvatarSeatOptions {
  readonly tableTopY: number;
  readonly outerEdgeZ: number;
}

const STICK_AVATAR_SCALE = 1.05;
const AVATAR_WORLD_SCALE = 5.2;
const CHAIR_SCALE = 1.45;

export class AvatarSeat {
  public readonly group: Group = new Group();
  private readonly avatarRoot: Group = new Group();
  private readonly materials: MeshStandardMaterial[] = [];
  private avatarMeshes: Mesh[] = [];
  private currentKind: AvatarKind = AvatarKind.Scout;

  public constructor(options: AvatarSeatOptions) {
    const seatY = options.tableTopY - 2.05;
    this.group.position.set(0, seatY, options.outerEdgeZ + 4.9);
    this.group.rotation.y = Math.PI;
    this.buildChair();
    this.avatarRoot.position.set(0, 0.12, 0.08);
    this.avatarRoot.scale.setScalar(AVATAR_WORLD_SCALE);
    this.group.add(this.avatarRoot);
    this.setAvatar(AvatarKind.Scout);
  }

  public setAvatar(kind: AvatarKind): void {
    if (kind === this.currentKind && this.avatarMeshes.length > 0) {
      return;
    }
    this.currentKind = kind;
    for (let i = 0; i < this.avatarMeshes.length; i += 1) {
      this.avatarRoot.remove(this.avatarMeshes[i]);
      this.avatarMeshes[i].geometry.dispose();
    }
    this.avatarMeshes = this.buildAvatarMeshes(kind);
    for (let i = 0; i < this.avatarMeshes.length; i += 1) {
      this.avatarRoot.add(this.avatarMeshes[i]);
    }
  }

  public dispose(): void {
    for (let i = 0; i < this.avatarMeshes.length; i += 1) {
      this.avatarMeshes[i].geometry.dispose();
    }
    for (let i = 0; i < this.materials.length; i += 1) {
      this.materials[i].dispose();
    }
  }

  private buildChair(): void {
    const wood = this.createMaterial(0x69492d, 0.92);
    const darkWood = this.createMaterial(0x50341d, 0.94);
    const seat = new Mesh(
      new BoxGeometry(1.7 * CHAIR_SCALE, 0.2 * CHAIR_SCALE, 1.6 * CHAIR_SCALE),
      wood,
    );
    seat.position.set(0, 0, 0);
    seat.castShadow = true;
    this.group.add(seat);

    const back = new Mesh(
      new BoxGeometry(1.7 * CHAIR_SCALE, 1.8 * CHAIR_SCALE, 0.2 * CHAIR_SCALE),
      darkWood,
    );
    back.position.set(0, 0.95 * CHAIR_SCALE, -0.7 * CHAIR_SCALE);
    back.castShadow = true;
    this.group.add(back);

    for (let ix = 0; ix < 2; ix += 1) {
      for (let iz = 0; iz < 2; iz += 1) {
        const leg = new Mesh(
          new BoxGeometry(0.18 * CHAIR_SCALE, 1.9 * CHAIR_SCALE, 0.18 * CHAIR_SCALE),
          darkWood,
        );
        leg.position.set(
          (ix === 0 ? -0.68 : 0.68) * CHAIR_SCALE,
          -0.95 * CHAIR_SCALE,
          (iz === 0 ? -0.62 : 0.62) * CHAIR_SCALE,
        );
        leg.castShadow = true;
        this.group.add(leg);
      }
    }
  }

  private buildAvatarMeshes(kind: AvatarKind): Mesh[] {
    if (kind === AvatarKind.Robot) {
      return this.buildRobotAvatar();
    }
    return this.buildHumanStickAvatar(kind);
  }

  private buildHumanStickAvatar(kind: AvatarKind): Mesh[] {
    const bodyColorByKind: Readonly<Record<AvatarKind, number>> = {
      [AvatarKind.Scout]: 0x7ec2ff,
      [AvatarKind.Sailor]: 0x4aa0d9,
      [AvatarKind.Builder]: 0xe6a74d,
      [AvatarKind.Robot]: 0x6f7d93,
    };
    const skin = this.createMaterial(0xf0d5b1, 0.9);
    const body = this.createMaterial(bodyColorByKind[kind], 0.88);
    const limb = this.createMaterial(0xeff6ff, 0.8);
    const meshes: Mesh[] = [];

    const head = new Mesh(new SphereGeometry(0.24 * STICK_AVATAR_SCALE, 10, 8), skin);
    const headRadius = kind === AvatarKind.Builder ? 0.21 : kind === AvatarKind.Sailor ? 0.23 : 0.24;
    head.geometry.dispose();
    head.geometry = new SphereGeometry(headRadius * STICK_AVATAR_SCALE, 10, 8);
    head.position.set(
      0,
      kind === AvatarKind.Builder ? 1.0 : kind === AvatarKind.Sailor ? 1.06 : 1.03,
      kind === AvatarKind.Sailor ? -0.24 : -0.2,
    );
    head.castShadow = true;
    meshes.push(head);
    this.appendHumanFace(meshes, kind, skin, head.position.y, head.position.z);

    if (kind === AvatarKind.Scout) {
      const cap = new Mesh(new BoxGeometry(0.34, 0.07, 0.3), body);
      cap.position.set(0, 1.18, -0.21);
      cap.castShadow = true;
      meshes.push(cap);
    } else if (kind === AvatarKind.Sailor) {
      const hat = new Mesh(new CylinderGeometry(0.24, 0.24, 0.06, 12), limb);
      hat.position.set(0, 1.18, -0.24);
      hat.castShadow = true;
      meshes.push(hat);
    } else {
      const helmet = new Mesh(new BoxGeometry(0.34, 0.16, 0.32), body);
      helmet.position.set(0, 1.14, -0.2);
      helmet.castShadow = true;
      meshes.push(helmet);
    }

    const torso = new Mesh(
      new CylinderGeometry(0.08, 0.1, 0.72 * STICK_AVATAR_SCALE, 7),
      body,
    );
    torso.position.set(
      0,
      kind === AvatarKind.Builder ? 0.54 : kind === AvatarKind.Sailor ? 0.62 : 0.58,
      kind === AvatarKind.Sailor ? -0.13 : -0.08,
    );
    torso.rotation.x =
      kind === AvatarKind.Builder ? -0.16 : kind === AvatarKind.Sailor ? -0.38 : -0.28;
    torso.castShadow = true;
    meshes.push(torso);

    for (let i = 0; i < 2; i += 1) {
      const x = i === 0 ? -0.2 : 0.2;
      const arm = new Mesh(
        new CylinderGeometry(0.035, 0.035, 0.52 * STICK_AVATAR_SCALE, 6),
        limb,
      );
      arm.position.set(x, kind === AvatarKind.Sailor ? 0.62 : 0.59, kind === AvatarKind.Sailor ? -0.04 : 0.02);
      arm.rotation.x =
        kind === AvatarKind.Scout ? -1.18 : kind === AvatarKind.Sailor ? -1.52 : -1.06;
      arm.rotation.z =
        i === 0
          ? kind === AvatarKind.Builder
            ? 0.34
            : 0.44
          : kind === AvatarKind.Builder
            ? -0.34
            : -0.44;
      arm.castShadow = true;
      meshes.push(arm);

      const upperLeg = new Mesh(
        new CylinderGeometry(0.045, 0.045, 0.47 * STICK_AVATAR_SCALE, 6),
        limb,
      );
      upperLeg.position.set(
        i === 0 ? -0.11 : 0.11,
        kind === AvatarKind.Builder ? 0.34 : 0.32,
        kind === AvatarKind.Builder ? 0.08 : 0.12,
      );
      upperLeg.rotation.x =
        kind === AvatarKind.Scout ? -1.2 : kind === AvatarKind.Sailor ? -1.38 : -1.03;
      upperLeg.rotation.z = i === 0 ? 0.04 : -0.04;
      upperLeg.castShadow = true;
      meshes.push(upperLeg);

      const lowerLeg = new Mesh(
        new CylinderGeometry(0.042, 0.042, 0.41 * STICK_AVATAR_SCALE, 6),
        limb,
      );
      lowerLeg.position.set(
        i === 0 ? -0.11 : 0.11,
        kind === AvatarKind.Builder ? 0.12 : 0.08,
        kind === AvatarKind.Builder ? 0.28 : 0.33,
      );
      lowerLeg.rotation.x =
        kind === AvatarKind.Scout ? -0.02 : kind === AvatarKind.Sailor ? -0.16 : 0.08;
      lowerLeg.castShadow = true;
      meshes.push(lowerLeg);
    }

    if (kind === AvatarKind.Builder) {
      const tool = new Mesh(new BoxGeometry(0.08, 0.35, 0.08), body);
      tool.position.set(0.32, 0.52, 0.13);
      tool.rotation.z = -0.25;
      tool.castShadow = true;
      meshes.push(tool);
    }
    return meshes;
  }

  private buildRobotAvatar(): Mesh[] {
    const shell = this.createMaterial(0x8a95ab, 0.75);
    const accent = this.createMaterial(0x9cd6ff, 0.55);
    const dark = this.createMaterial(0x38475f, 0.6);
    const meshes: Mesh[] = [];

    const head = new Mesh(new BoxGeometry(0.42, 0.34, 0.34), shell);
    head.position.set(0, 0.94, -0.16);
    head.castShadow = true;
    meshes.push(head);
    this.appendRobotFace(meshes, head.position.y, head.position.z, accent, dark);

    const body = new Mesh(new BoxGeometry(0.48, 0.58, 0.34), shell);
    body.position.set(0, 0.54, -0.06);
    body.rotation.x = -0.22;
    body.castShadow = true;
    meshes.push(body);

    const eye = new Mesh(new BoxGeometry(0.2, 0.07, 0.03), accent);
    eye.position.set(0, 0.95, 0.04);
    meshes.push(eye);

    const antenna = new Mesh(new CylinderGeometry(0.02, 0.02, 0.24, 6), dark);
    antenna.position.set(0, 1.16, -0.17);
    meshes.push(antenna);

    for (let i = 0; i < 2; i += 1) {
      const side = i === 0 ? -1 : 1;
      const arm = new Mesh(new BoxGeometry(0.13, 0.45, 0.13), dark);
      arm.position.set(side * 0.31, 0.56, 0.01);
      arm.rotation.x = -1.16;
      arm.rotation.z = side * -0.1;
      arm.castShadow = true;
      meshes.push(arm);

      const upperLeg = new Mesh(new BoxGeometry(0.14, 0.27, 0.14), dark);
      upperLeg.position.set(side * 0.12, 0.3, 0.09);
      upperLeg.rotation.x = -0.94;
      upperLeg.castShadow = true;
      meshes.push(upperLeg);

      const lowerLeg = new Mesh(new BoxGeometry(0.14, 0.25, 0.14), dark);
      lowerLeg.position.set(side * 0.12, 0.09, 0.26);
      lowerLeg.rotation.x = -0.08;
      lowerLeg.castShadow = true;
      meshes.push(lowerLeg);
    }
    return meshes;
  }

  private appendHumanFace(
    meshes: Mesh[],
    kind: AvatarKind,
    skin: MeshStandardMaterial,
    headY: number,
    headZ: number,
  ): void {
    const eyeMaterial = this.createMaterial(0x1f2a3b, 0.7);
    const mouthMaterial = this.createMaterial(0x7e2731, 0.68);
    const eyeY = headY + (kind === AvatarKind.Sailor ? 0.01 : 0.02);
    const eyeZ = headZ + 0.2;
    const eyeRadius = kind === AvatarKind.Builder ? 0.028 : 0.025;
    for (let i = 0; i < 2; i += 1) {
      const eye = new Mesh(new SphereGeometry(eyeRadius, 8, 8), eyeMaterial);
      eye.position.set(i === 0 ? -0.08 : 0.08, eyeY, eyeZ);
      meshes.push(eye);
    }

    const nose = new Mesh(new ConeGeometry(0.024, 0.08, 8), skin);
    nose.position.set(0, headY - 0.035, eyeZ + 0.01);
    nose.rotation.x = Math.PI / 2;
    meshes.push(nose);

    if (kind === AvatarKind.Scout) {
      const smile = new Mesh(new CylinderGeometry(0.06, 0.06, 0.012, 12), mouthMaterial);
      smile.position.set(0, headY - 0.13, eyeZ + 0.01);
      smile.scale.set(1.1, 0.45, 1);
      meshes.push(smile);
      return;
    }

    if (kind === AvatarKind.Sailor) {
      const openMouth = new Mesh(new SphereGeometry(0.036, 10, 10), mouthMaterial);
      openMouth.position.set(0, headY - 0.14, eyeZ + 0.008);
      openMouth.scale.set(0.95, 1.2, 0.7);
      meshes.push(openMouth);
      return;
    }

    const sternMouth = new Mesh(new BoxGeometry(0.12, 0.015, 0.015), mouthMaterial);
    sternMouth.position.set(0, headY - 0.13, eyeZ + 0.012);
    sternMouth.rotation.z = -0.12;
    meshes.push(sternMouth);
  }

  private appendRobotFace(
    meshes: Mesh[],
    headY: number,
    headZ: number,
    accent: MeshStandardMaterial,
    dark: MeshStandardMaterial,
  ): void {
    const eyeLeft = new Mesh(new BoxGeometry(0.07, 0.05, 0.024), accent);
    eyeLeft.position.set(-0.085, headY + 0.01, headZ + 0.18);
    meshes.push(eyeLeft);

    const eyeRight = new Mesh(new BoxGeometry(0.07, 0.05, 0.024), accent);
    eyeRight.position.set(0.085, headY + 0.01, headZ + 0.18);
    meshes.push(eyeRight);

    const nose = new Mesh(new BoxGeometry(0.026, 0.05, 0.03), dark);
    nose.position.set(0, headY - 0.045, headZ + 0.18);
    meshes.push(nose);

    const mouth = new Mesh(new BoxGeometry(0.13, 0.018, 0.024), dark);
    mouth.position.set(0, headY - 0.11, headZ + 0.18);
    meshes.push(mouth);
  }

  private createMaterial(color: number, roughness: number): MeshStandardMaterial {
    const material = new MeshStandardMaterial({ color, roughness, metalness: 0, flatShading: true });
    this.materials.push(material);
    return material;
  }
}
