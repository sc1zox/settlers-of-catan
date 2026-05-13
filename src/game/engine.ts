import {
  Clock,
  Color,
  Fog,
  Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Board } from './board/board';
import { HEX_SIZE } from './board/hex';
import { HoverHandler, HoverSystem } from './interaction/hover';
import { addLighting } from './scene/lighting';
import { createCamera, createControls } from './scene/camera';
import { createHarbors, HarborSystem } from './world/harbors';
import { World } from './world/world';

export interface EngineOptions {
  readonly seed?: number;
}

export class GameEngine {
  private readonly container: HTMLElement;
  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private readonly renderer: WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly clock: Clock;
  private readonly board: Board;
  private readonly world: World;
  private readonly harbors: HarborSystem;
  private readonly hover: HoverSystem;
  private readonly resizeObserver: ResizeObserver;

  private rafId: number | null = null;
  private running = false;

  constructor(container: HTMLElement, options: EngineOptions = {}) {
    this.container = container;

    this.scene = new Scene();
    this.scene.background = new Color(0xbfe4ff);
    this.scene.fog = new Fog(0xbfe4ff, 50, 140);

    const { clientWidth, clientHeight } = container;
    const aspect = clientWidth / Math.max(clientHeight, 1);
    this.camera = createCamera(aspect);

    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(clientWidth, clientHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.controls = createControls(this.camera, this.renderer.domElement);

    addLighting(this.scene);

    // Disc large enough that the harbours sit comfortably out in the water
    // around the island.
    const discRadius = HEX_SIZE * 6.4;
    this.world = new World({ discRadius });
    this.scene.add(this.world.group);

    this.board = new Board({ seed: options.seed });
    this.scene.add(this.board.group);

    this.harbors = createHarbors();
    this.scene.add(this.harbors.group);

    const hoverables: Object3D[] = [];
    for (const tile of this.board.tiles) {
      const sprite = tile.getChipSprite();
      if (sprite) hoverables.push(sprite);
    }
    for (const harbor of this.harbors.harbors) hoverables.push(harbor.pickMesh);
    this.hover = new HoverSystem(this.renderer.domElement, this.camera, hoverables);

    this.clock = new Clock(false);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.loop();
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.clock.stop();
  }

  setHoverHandler(handler: HoverHandler | null): void {
    this.hover.setHandler(handler);
  }

  dispose(): void {
    this.stop();
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.hover.dispose();
    this.board.dispose();
    this.world.dispose();
    this.scene.clear();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  private readonly loop = (): void => {
    if (!this.running) return;
    const dt = this.clock.getDelta();
    const t = this.clock.elapsedTime;
    this.board.update(dt, t);
    this.world.update(dt, t);
    this.controls.update();
    this.hover.update();
    this.renderer.render(this.scene, this.camera);
    this.rafId = requestAnimationFrame(this.loop);
  };

  private handleResize(): void {
    const { clientWidth, clientHeight } = this.container;
    if (clientWidth === 0 || clientHeight === 0) return;
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight, false);
  }
}
