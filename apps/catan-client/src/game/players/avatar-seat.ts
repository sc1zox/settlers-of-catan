import {
  BoxGeometry,
  CanvasTexture,
  ClampToEdgeWrapping,
  Color,
  CylinderGeometry,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NormalBlending,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
  VideoTexture,
} from 'three';
import { PlayerColor } from './player-color.enum';
import { PresenceMaterialDimmer } from './presence-material-dimmer';

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
const NAME_PLATE_BOB_AMPLITUDE = 0.02;
const NAME_PLATE_BOB_SPEED = 1.6;
const NAME_PLATE_TEXTURE_WIDTH = 1024;
const NAME_PLATE_TEXTURE_HEIGHT = 256;

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
  private readonly namePlateRoot: Group;
  private readonly namePlateFrontMesh: Mesh;
  private readonly namePlateBackMesh: Mesh;
  private namePlateTexture: CanvasTexture | null = null;
  private namePlateLabel = '';
  private readonly namePlateColor: number;
  private namePlateTime = 0;
  private presenceDimmed = false;
  private readonly presenceDimmer = new PresenceMaterialDimmer();
  private readonly onVideoFrameGeometryReady = (): void => {
    this.ensureVideoTextureFromAttached();
  };

  public constructor(options: AvatarSeatOptions) {
    this.namePlateColor = options.bodyColor;
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
      opacity: 1,
      toneMapped: false,
      blending: NormalBlending,
      depthWrite: false,
      depthTest: true,
    });
    const namePlateGeometry = new PlaneGeometry(NAME_PLATE_WIDTH, NAME_PLATE_HEIGHT);
    this.namePlateFrontMesh = new Mesh(namePlateGeometry, this.namePlateMaterial);
    this.namePlateBackMesh = new Mesh(namePlateGeometry, this.namePlateMaterial);
    this.namePlateBackMesh.rotation.y = Math.PI;
    this.namePlateRoot = new Group();
    this.namePlateRoot.position.set(0, NAME_PLATE_Y, NAME_PLATE_Z);
    this.namePlateRoot.add(this.namePlateFrontMesh);
    this.namePlateRoot.add(this.namePlateBackMesh);
    this.avatarRoot.add(this.namePlateRoot);
    this.buildMinimalBody(bodyMat, limbMat);
    this.buildSquareHead();
    this.presenceDimmer.register([
      bodyMat,
      limbMat,
      this.screenMaterial,
      this.namePlateMaterial,
      ...this.materials,
    ]);
  }

  public setPresenceDimmed(dimmed: boolean): void {
    if (dimmed === this.presenceDimmed) {
      return;
    }
    this.presenceDimmed = dimmed;
    this.presenceDimmer.setDimmed(dimmed);
    this.applyScreenPresenceState();
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
    this.namePlateRoot.position.y = NAME_PLATE_Y + wobble;
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
    this.namePlateTexture = AvatarSeat.buildNamePlateTexture(normalized, this.namePlateColor);
    this.namePlateMaterial.map = this.namePlateTexture;
    this.namePlateMaterial.needsUpdate = true;
  }

  /**
   * World-space anchor where a fly-in bonus card should appear "in front of"
   * this avatar — the head if it exists, otherwise the seat root. The avatar
   * group sits behind the table looking inward, so this point is naturally on
   * the same side as the player.
   */
  public getHeadWorldPosition(out: Vector3): Vector3 {
    if (this.headMesh !== null) {
      this.headMesh.getWorldPosition(out);
      return out;
    }
    this.group.getWorldPosition(out);
    return out;
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
    this.namePlateFrontMesh.geometry.dispose();
    this.screenMaterial.dispose();
    if (this.headMesh !== null) {
      this.headMesh.geometry.dispose();
    }
    for (let i = 0; i < this.materials.length; i += 1) {
      this.materials[i].dispose();
    }
  }

  private applyVideoDisplayGamma(): void {
    this.applyScreenPresenceState();
  }

  private applyScreenPresenceState(): void {
    if (this.presenceDimmed) {
      this.screenMaterial.color.setRGB(0.22, 0.24, 0.28);
      this.screenMaterial.needsUpdate = true;
      return;
    }
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

  private static buildNamePlateTexture(name: string, playerColor: number): CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = NAME_PLATE_TEXTURE_WIDTH;
    canvas.height = NAME_PLATE_TEXTURE_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (ctx === null) {
      const fallback = new CanvasTexture(canvas);
      fallback.colorSpace = SRGBColorSpace;
      return fallback;
    }

    const palette = AvatarSeat.namePlatePalette(playerColor);
    const w = canvas.width;
    const h = canvas.height;
    const padX = 56;
    const padY = 48;
    const plateLeft = padX;
    const plateRight = w - padX;
    const plateTop = padY;
    const plateBottom = h - padY;
    const plateHeight = plateBottom - plateTop;
    const notch = plateHeight * 0.42;

    ctx.clearRect(0, 0, w, h);

    AvatarSeat.tracePlatePath(ctx, plateLeft, plateTop, plateRight, plateBottom, notch);
    const fill = ctx.createLinearGradient(0, plateTop, 0, plateBottom);
    fill.addColorStop(0, palette.fillTop);
    fill.addColorStop(1, palette.fillBottom);
    ctx.fillStyle = fill;
    ctx.fill();

    const accentTop = plateTop + 6;
    const accentBottom = plateBottom - 6;
    const accent = ctx.createLinearGradient(0, accentTop, 0, accentBottom);
    accent.addColorStop(0, palette.border);
    accent.addColorStop(0.5, palette.borderBright);
    accent.addColorStop(1, palette.border);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.shadowColor = palette.borderGlow;
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = palette.tick;
    const tickThickness = 6;
    const tickHeight = plateHeight * 0.46;
    const tickYTop = plateTop + (plateHeight - tickHeight) / 2;
    ctx.fillRect(plateLeft + 22, tickYTop, tickThickness, tickHeight);
    ctx.fillRect(plateRight - 22 - tickThickness, tickYTop, tickThickness, tickHeight);

    const upper = name.toUpperCase();
    const baseFont =
      '700 110px "Rajdhani", "Eurostile", "Bahnschrift", "Inter", "Segoe UI", system-ui, sans-serif';
    ctx.font = baseFont;
    const trackingPx = 6;
    AvatarSeat.fillTrackedText(ctx, upper, w / 2, h / 2 + 4, trackingPx, {
      fill: palette.textFill,
      glow: palette.textGlow,
      glowBlur: 18,
      stroke: palette.textStroke,
      strokeWidth: 2,
    });

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearFilter;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
  }

  private static namePlatePalette(playerColor: number): {
    fillTop: string;
    fillBottom: string;
    border: string;
    borderBright: string;
    borderGlow: string;
    tick: string;
    textFill: string;
    textGlow: string;
    textStroke: string;
  } {
    const base = new Color(playerColor);
    const isWhite = playerColor === PlayerColor.White;
    const fillDark = base.clone().lerp(new Color(0, 0, 0), isWhite ? 0.52 : 0.28);
    const fillDarker = base.clone().lerp(new Color(0, 0, 0), isWhite ? 0.68 : 0.42);
    const border = base.clone();
    if (isWhite) {
      border.lerp(new Color(0.55, 0.58, 0.64), 0.35);
    } else {
      border.lerp(new Color(1, 1, 1), 0.18);
    }
    const borderBright = border.clone().lerp(new Color(1, 1, 1), isWhite ? 0.28 : 0.38);
    const tick = borderBright.clone().lerp(new Color(1, 1, 1), 0.12);
    return {
      fillTop: AvatarSeat.rgba(fillDark, 0.96),
      fillBottom: AvatarSeat.rgba(fillDarker, 0.98),
      border: AvatarSeat.rgba(border, 1),
      borderBright: AvatarSeat.rgba(borderBright, 1),
      borderGlow: AvatarSeat.rgba(borderBright, isWhite ? 0.82 : 0.9),
      tick: AvatarSeat.rgba(tick, 0.98),
      textFill: isWhite ? 'rgba(18, 24, 36, 0.98)' : 'rgba(248, 252, 255, 0.98)',
      textGlow: AvatarSeat.rgba(borderBright, isWhite ? 0.7 : 0.95),
      textStroke: isWhite ? 'rgba(255, 255, 255, 0.82)' : 'rgba(6, 12, 22, 0.9)',
    };
  }

  private static rgba(color: Color, alpha: number): string {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private static tracePlatePath(
    ctx: CanvasRenderingContext2D,
    left: number,
    top: number,
    right: number,
    bottom: number,
    notch: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(left + notch, top);
    ctx.lineTo(right - notch, top);
    ctx.lineTo(right, top + notch);
    ctx.lineTo(right, bottom - notch);
    ctx.lineTo(right - notch, bottom);
    ctx.lineTo(left + notch, bottom);
    ctx.lineTo(left, bottom - notch);
    ctx.lineTo(left, top + notch);
    ctx.closePath();
  }

  private static fillTrackedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    centerX: number,
    centerY: number,
    trackingPx: number,
    style: {
      fill: string;
      glow: string;
      glowBlur: number;
      stroke: string;
      strokeWidth: number;
    },
  ): void {
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    let totalWidth = -trackingPx;
    const widths = new Array<number>(text.length);
    for (let i = 0; i < text.length; i += 1) {
      const wMeasured = ctx.measureText(text.charAt(i)).width;
      widths[i] = wMeasured;
      totalWidth += wMeasured + trackingPx;
    }
    let cursor = centerX - totalWidth / 2;
    ctx.shadowColor = style.glow;
    ctx.shadowBlur = style.glowBlur;
    ctx.fillStyle = style.fill;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text.charAt(i);
      ctx.fillText(ch, cursor, centerY);
      cursor += widths[i] + trackingPx;
    }
    ctx.shadowBlur = 0;
    cursor = centerX - totalWidth / 2;
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = style.strokeWidth;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text.charAt(i);
      ctx.strokeText(ch, cursor, centerY);
      cursor += widths[i] + trackingPx;
    }
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
