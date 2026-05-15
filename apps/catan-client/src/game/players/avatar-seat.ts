import { WEBCAM_MEDIA_SCOPE, WebcamMediaScopeKey } from '@catan/api-interfaces';
import {
  BoxGeometry,
  ClampToEdgeWrapping,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  VideoTexture,
} from 'three';

export interface AvatarSeatOptions {
  readonly tableTopY: number;
  readonly outerEdgeZ: number;
  readonly bodyColor: number;
}

const AVATAR_WORLD_SCALE = 5.2;
const CHAIR_SCALE = 1.45;
const HEAD_SIZE = 0.98;
const HEAD_DEPTH = 0.11;
const HEAD_Y = 1.28;
const HEAD_Z = -0.16;
const HEAD_FRAME_PAD = 0.05;
const HEAD_SCREEN_INSET = 0.035;
const HEAD_SCREEN_ASPECT =
  WEBCAM_MEDIA_SCOPE[WebcamMediaScopeKey.MediumWidth] /
  WEBCAM_MEDIA_SCOPE[WebcamMediaScopeKey.MediumHeight];
const DEFAULT_VIDEO_DISPLAY_GAMMA = 1.55;

export class AvatarSeat {
  public readonly group: Group = new Group();
  private readonly avatarRoot: Group = new Group();
  private readonly materials: MeshStandardMaterial[] = [];
  private readonly screenMaterial: MeshBasicMaterial;
  private headMesh: Mesh | null = null;
  private videoTexture: VideoTexture | null = null;
  private attachedVideo: HTMLVideoElement | null = null;
  private videoDisplayGamma = DEFAULT_VIDEO_DISPLAY_GAMMA;
  private readonly onVideoFrameGeometryReady = (): void => {
    this.ensureVideoTextureFromAttached();
  };

  public constructor(options: AvatarSeatOptions) {
    const seatY = options.tableTopY - 2.05;
    this.group.position.set(0, seatY, options.outerEdgeZ + 4.9);
    this.group.rotation.y = Math.PI;
    this.buildChair();
    this.avatarRoot.position.set(0, 0.12, 0.08);
    this.avatarRoot.scale.setScalar(AVATAR_WORLD_SCALE);
    this.group.add(this.avatarRoot);

    const bodyMat = this.createMaterial(options.bodyColor, 0.88);
    const limbMat = this.createMaterial(0xeff6ff, 0.8);
    this.screenMaterial = new MeshBasicMaterial({
      color: new Color(DEFAULT_VIDEO_DISPLAY_GAMMA, DEFAULT_VIDEO_DISPLAY_GAMMA, DEFAULT_VIDEO_DISPLAY_GAMMA),
      toneMapped: false,
    });
    this.buildMinimalBody(bodyMat, limbMat);
    this.buildSquareHead();
  }

  public setVideoDisplayGamma(gamma: number): void {
    this.videoDisplayGamma = gamma;
    this.applyVideoDisplayGamma();
  }

  public setVideoElement(video: HTMLVideoElement | null): void {
    if (this.attachedVideo === video) {
      return;
    }
    this.teardownVideoListeners();
    this.disposeVideoTextureOnly();
    this.attachedVideo = video;
    if (video === null || this.headMesh === null) {
      this.screenMaterial.map = null;
      this.screenMaterial.color.setHex(0x2a3344);
      this.screenMaterial.needsUpdate = true;
      return;
    }
    video.addEventListener('loadedmetadata', this.onVideoFrameGeometryReady);
    video.addEventListener('resize', this.onVideoFrameGeometryReady);
    video.addEventListener('playing', this.onVideoFrameGeometryReady);
    this.screenMaterial.map = null;
    this.screenMaterial.color.setHex(0x2a3344);
    this.screenMaterial.needsUpdate = true;
    this.ensureVideoTextureFromAttached();
  }

  public update(): void {
    if (
      this.videoTexture !== null &&
      this.attachedVideo !== null &&
      this.attachedVideo.videoWidth > 0 &&
      this.attachedVideo.videoHeight > 0
    ) {
      this.videoTexture.needsUpdate = true;
    }
  }

  public dispose(): void {
    this.teardownVideoListeners();
    this.disposeVideoTextureOnly();
    this.attachedVideo = null;
    this.screenMaterial.dispose();
    if (this.headMesh !== null) {
      this.headMesh.geometry.dispose();
    }
    for (let i = 0; i < this.materials.length; i += 1) {
      this.materials[i].dispose();
    }
  }

  private applyVideoDisplayGamma(): void {
    const gamma = this.videoDisplayGamma;
    this.screenMaterial.color.setRGB(gamma, gamma, gamma);
    this.screenMaterial.needsUpdate = true;
  }

  private teardownVideoListeners(): void {
    const video = this.attachedVideo;
    if (video === null) {
      return;
    }
    video.removeEventListener('loadedmetadata', this.onVideoFrameGeometryReady);
    video.removeEventListener('resize', this.onVideoFrameGeometryReady);
    video.removeEventListener('playing', this.onVideoFrameGeometryReady);
  }

  private disposeVideoTextureOnly(): void {
    if (this.videoTexture !== null) {
      this.videoTexture.dispose();
      this.videoTexture = null;
    }
    this.screenMaterial.map = null;
  }

  private ensureVideoTextureFromAttached(): void {
    const video = this.attachedVideo;
    if (video === null || this.headMesh === null) {
      return;
    }
    if (video.videoWidth <= 0 || video.videoHeight <= 0) {
      return;
    }
    if (this.videoTexture !== null) {
      return;
    }
    const texture = new VideoTexture(video);
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.flipY = true;
    this.videoTexture = texture;
    this.screenMaterial.map = texture;
    this.applyVideoDisplayGamma();
  }

  private buildMinimalBody(body: MeshStandardMaterial, limb: MeshStandardMaterial): void {
    const torso = new Mesh(new CylinderGeometry(0.09, 0.11, 0.62, 6), body);
    torso.position.set(0, 0.58, -0.08);
    torso.rotation.x = -0.28;
    torso.castShadow = true;
    this.avatarRoot.add(torso);

    for (let i = 0; i < 2; i += 1) {
      const x = i === 0 ? -0.18 : 0.18;
      const arm = new Mesh(new CylinderGeometry(0.035, 0.035, 0.48, 6), limb);
      arm.position.set(x, 0.6, 0.02);
      arm.rotation.x = -1.2;
      arm.rotation.z = i === 0 ? 0.4 : -0.4;
      arm.castShadow = true;
      this.avatarRoot.add(arm);

      const leg = new Mesh(new CylinderGeometry(0.045, 0.045, 0.5, 6), limb);
      leg.position.set(i === 0 ? -0.1 : 0.1, 0.28, 0.14);
      leg.rotation.x = -1.1;
      leg.castShadow = true;
      this.avatarRoot.add(leg);
    }
  }

  private buildSquareHead(): void {
    const screenHeight = HEAD_SIZE - HEAD_SCREEN_INSET;
    const screenWidth = screenHeight * HEAD_SCREEN_ASPECT;
    const frame = new Mesh(
      new BoxGeometry(screenWidth + HEAD_FRAME_PAD, screenHeight + HEAD_FRAME_PAD, HEAD_DEPTH),
      this.createMaterial(0x1a2230, 0.9),
    );
    frame.position.set(0, HEAD_Y, HEAD_Z);
    frame.castShadow = true;

    const screen = new Mesh(new PlaneGeometry(screenWidth, screenHeight), this.screenMaterial);
    screen.position.set(0, HEAD_Y, HEAD_Z + HEAD_DEPTH * 0.52);
    screen.scale.x = -1;
    screen.castShadow = true;

    this.avatarRoot.add(frame);
    this.avatarRoot.add(screen);
    this.headMesh = screen;
  }

  private buildChair(): void {
    const wood = this.createMaterial(0x69492d, 0.92);
    const darkWood = this.createMaterial(0x50341d, 0.94);
    const seat = new Mesh(
      new BoxGeometry(1.7 * CHAIR_SCALE, 0.2 * CHAIR_SCALE, 1.6 * CHAIR_SCALE),
      wood,
    );
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

  private createMaterial(color: number, roughness: number): MeshStandardMaterial {
    const material = new MeshStandardMaterial({
      color: new Color(color),
      roughness,
      metalness: 0,
      flatShading: true,
    });
    this.materials.push(material);
    return material;
  }
}
