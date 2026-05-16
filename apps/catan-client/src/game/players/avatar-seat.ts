import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  ClampToEdgeWrapping,
  Color,
  CylinderGeometry,
  DoubleSide,
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
const HEAD_VIDEO_CAPTURE_WIDTH = 480;
const HEAD_VIDEO_CAPTURE_HEIGHT = 360;
const HEAD_SCREEN_ASPECT = HEAD_VIDEO_CAPTURE_WIDTH / HEAD_VIDEO_CAPTURE_HEIGHT;
const DEFAULT_VIDEO_DISPLAY_GAMMA = 1.55;
const NAME_PLATE_WIDTH = 1.42;
const NAME_PLATE_HEIGHT = 0.34;
const NAME_PLATE_Y = 2.02;
const NAME_PLATE_Z = -0.12;
const NAME_PLATE_BASE_OPACITY = 0.88;
const NAME_PLATE_BOB_AMPLITUDE = 0.03;
const NAME_PLATE_BOB_SPEED = 1.9;
const NAME_PLATE_PULSE_SPEED = 2.4;
const NAME_PLATE_PULSE_AMPLITUDE = 0.12;

export interface AvatarSeatVideoOptions {
  readonly placeholderWhenEmpty: boolean;
}

export class AvatarSeat {
  public readonly group: Group = new Group();
  private readonly avatarRoot: Group = new Group();
  private readonly materials: MeshStandardMaterial[] = [];
  private readonly screenMaterial: MeshBasicMaterial;
  private headMesh: Mesh | null = null;
  private videoTexture: VideoTexture | null = null;
  private smileyTexture: CanvasTexture | null = null;
  private attachedVideo: HTMLVideoElement | null = null;
  private emptyDisplayUsesPlaceholder = false;
  private videoDisplayGamma = DEFAULT_VIDEO_DISPLAY_GAMMA;
  private readonly namePlateMaterial: MeshBasicMaterial;
  private readonly namePlateMesh: Mesh;
  private namePlateTexture: CanvasTexture | null = null;
  private namePlateLabel = '';
  private namePlateTime = 0;
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
      color: new Color(
        DEFAULT_VIDEO_DISPLAY_GAMMA,
        DEFAULT_VIDEO_DISPLAY_GAMMA,
        DEFAULT_VIDEO_DISPLAY_GAMMA,
      ),
      toneMapped: false,
    });
    this.namePlateMaterial = new MeshBasicMaterial({
      transparent: true,
      opacity: NAME_PLATE_BASE_OPACITY,
      toneMapped: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      depthWrite: false,
      depthTest: true,
    });
    this.namePlateMesh = new Mesh(
      new PlaneGeometry(NAME_PLATE_WIDTH, NAME_PLATE_HEIGHT),
      this.namePlateMaterial,
    );
    this.namePlateMesh.position.set(0, NAME_PLATE_Y, NAME_PLATE_Z);
    this.avatarRoot.add(this.namePlateMesh);
    this.buildMinimalBody(bodyMat, limbMat);
    this.buildSquareHead();
  }

  public setVideoDisplayGamma(gamma: number): void {
    this.videoDisplayGamma = gamma;
    this.applyVideoDisplayGamma();
  }

  public setVideoElement(video: HTMLVideoElement | null, options?: AvatarSeatVideoOptions): void {
    const placeholderWhenEmpty = options?.placeholderWhenEmpty === true;
    if (this.attachedVideo === video && video !== null) {
      return;
    }
    if (
      this.attachedVideo === video &&
      video === null &&
      this.emptyDisplayUsesPlaceholder === placeholderWhenEmpty
    ) {
      return;
    }
    this.teardownVideoListeners();
    this.disposeVideoTextureOnly();
    this.disposeSmileyTextureOnly();
    this.attachedVideo = video;
    this.emptyDisplayUsesPlaceholder = video === null ? placeholderWhenEmpty : false;
    if (video === null || this.headMesh === null) {
      if (video === null && placeholderWhenEmpty) {
        this.applySmileyPlaceholder();
      } else {
        this.screenMaterial.map = null;
        this.screenMaterial.color.setHex(0x2a3344);
        this.screenMaterial.needsUpdate = true;
      }
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

  public update(dt: number): void {
    if (
      this.videoTexture !== null &&
      this.attachedVideo !== null &&
      this.attachedVideo.videoWidth > 0 &&
      this.attachedVideo.videoHeight > 0
    ) {
      this.videoTexture.needsUpdate = true;
    }
    this.namePlateTime += dt;
    const wobble = Math.sin(this.namePlateTime * NAME_PLATE_BOB_SPEED) * NAME_PLATE_BOB_AMPLITUDE;
    this.namePlateMesh.position.y = NAME_PLATE_Y + wobble;
    const pulse =
      NAME_PLATE_BASE_OPACITY +
      Math.sin(this.namePlateTime * NAME_PLATE_PULSE_SPEED) * NAME_PLATE_PULSE_AMPLITUDE;
    this.namePlateMaterial.opacity = pulse;
  }

  public setDisplayName(name: string): void {
    const normalized = name.trim().length > 0 ? name.trim() : 'Spieler';
    if (normalized === this.namePlateLabel) {
      return;
    }
    this.namePlateLabel = normalized;
    if (this.namePlateTexture !== null) {
      this.namePlateTexture.dispose();
      this.namePlateTexture = null;
    }
    this.namePlateTexture = AvatarSeat.buildNamePlateTexture(normalized);
    this.namePlateMaterial.map = this.namePlateTexture;
    this.namePlateMaterial.needsUpdate = true;
  }

  public dispose(): void {
    this.teardownVideoListeners();
    this.disposeVideoTextureOnly();
    this.disposeSmileyTextureOnly();
    this.attachedVideo = null;
    if (this.namePlateTexture !== null) {
      this.namePlateTexture.dispose();
      this.namePlateTexture = null;
    }
    this.namePlateMaterial.dispose();
    this.namePlateMesh.geometry.dispose();
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

  private disposeSmileyTextureOnly(): void {
    if (this.smileyTexture === null) {
      return;
    }
    if (this.screenMaterial.map === this.smileyTexture) {
      this.screenMaterial.map = null;
    }
    this.smileyTexture.dispose();
    this.smileyTexture = null;
  }

  private applySmileyPlaceholder(): void {
    if (this.smileyTexture === null) {
      this.smileyTexture = AvatarSeat.buildSmileyCanvasTexture();
    }
    this.screenMaterial.map = this.smileyTexture;
    this.applyVideoDisplayGamma();
    this.screenMaterial.needsUpdate = true;
  }

  private static buildSmileyCanvasTexture(): CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx === null) {
      const fallback = new CanvasTexture(canvas);
      fallback.colorSpace = SRGBColorSpace;
      return fallback;
    }
    ctx.fillStyle = '#ffcc33';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d4a017';
    ctx.lineWidth = size * 0.02;
    ctx.stroke();
    ctx.fillStyle = '#1a2230';
    ctx.beginPath();
    ctx.arc(size * 0.36, size * 0.42, size * 0.055, 0, Math.PI * 2);
    ctx.arc(size * 0.64, size * 0.42, size * 0.055, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a2230';
    ctx.lineWidth = size * 0.035;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(size / 2, size * 0.52, size * 0.14, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  private static buildNamePlateTexture(name: string): CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx === null) {
      const fallback = new CanvasTexture(canvas);
      fallback.colorSpace = SRGBColorSpace;
      return fallback;
    }

    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, 'rgba(0, 214, 255, 0.24)');
    gradient.addColorStop(0.5, 'rgba(193, 71, 255, 0.42)');
    gradient.addColorStop(1, 'rgba(0, 214, 255, 0.24)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 42, canvas.width, canvas.height - 84);

    ctx.strokeStyle = 'rgba(130, 230, 255, 0.78)';
    ctx.lineWidth = 8;
    ctx.strokeRect(24, 52, canvas.width - 48, canvas.height - 104);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.font = 'bold 108px "Comic Sans MS", "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 242, 255, 0.95)';
    ctx.shadowBlur = 26;
    ctx.fillText(name, canvas.width / 2, canvas.height / 2);

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.44)';
    ctx.lineWidth = 3;
    ctx.strokeText(name, canvas.width / 2, canvas.height / 2);

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
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
