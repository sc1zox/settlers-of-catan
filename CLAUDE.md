# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm start` — dev server at http://localhost:4200 with HMR (`ng serve` under the hood)
- `npm run build` — production build to `dist/` (1MB initial / 4kB per-component-style budgets)
- `npm run watch` — incremental dev build
- `npm test` — Vitest via `@angular/build:unit-test` (jsdom env). To filter: `npx ng test --test-name-pattern="App"`
- `npm run lint` — ESLint (typescript-eslint + angular-eslint, prettier-compatible)
- `npm run format` / `npm run format:check` — Prettier across `src/**/*.{ts,html,scss,json}`

TypeScript is in strict mode with `noPropertyAccessFromIndexSignature` — `userData['kind']` (bracket access) is intentional, do not "fix" it to dot access.

## Architecture

Angular 21 standalone-component shell wrapping a Three.js scene. Angular only owns the host `<div>` and a single tooltip overlay; everything else is plain TS classes under `src/game/`.

### Angular ↔ Three.js boundary

`GameCanvasComponent` (`src/app/game-canvas/game-canvas.ts`) is the only bridge:

- Constructs `GameEngine` inside `ngZone.runOutsideAngular(...)` so the per-frame `requestAnimationFrame` loop never triggers change detection.
- Registers a hover handler with the engine; when a hover event fires, it calls `ngZone.run(...)` to flip the `harborTooltip` signal — this is the *only* path back into Angular's zone. New DOM-overlay UI must follow the same pattern.

### `GameEngine` (`src/game/engine.ts`)

Owns the scene graph and lifecycle. Composes — does not subclass — five subsystems, each a self-contained `Group`-bearing class with `update(dt, t)` and `dispose()`:

- `Table` — tabletop slab the disc sits on
- `World` — water surface (everything outside the land disc)
- `Board` — the 19 land hex tiles
- `HarborSystem` — 9 harbor buildings on the outer water ring
- `PlayerArea[]` — four seats with cards + figure arsenals

`HoverSystem` raycasts against a flat array of "hoverable" `Object3D`s harvested at construction (chip sprites, harbor pick meshes, card meshes). Each frame in the RAF loop: `board.update → world.update → players.update → controls.update → hover.update → renderer.render`.

Disposal is strict: every subsystem disposes its geometries and materials. Adding new GPU resources requires wiring them into the matching `dispose()`.

### Hex coordinate system

`src/game/board/hex.ts` defines pointy-top **axial** coordinates (`q`, `r`) on the x/z plane with +Y up. `axialToWorld` converts. `hexRing(radius)` and `hexDisc(radius)` enumerate coords; `RING_WALK_DIRECTIONS` and the harbor-side `NEIGHBOR_DIRS` are *different* orderings — don't conflate them. `HEX_SIZE` (2.4) is the canonical hex radius.

### Tile hierarchy

`Tile` (abstract, `src/game/tiles/tile.ts`) builds the slab + outline + floating "number chip" sprite + projection beam, and exposes hover state via `setChipHovered`. Subclasses (`ForestTile`, `FieldsTile`, etc.) layer on decorations and animation; **they must call `super.update(dt, t)`** or the chip stops bobbing. `TileFactory.createTile()` dispatches on `TileType`.

Three Y-axis constants are load-bearing across the codebase:
- `TILE_HEIGHT = 1.0` — slab top
- `WATER_LEVEL_Y = -0.4` — water surface (lower than tile top so cliffs are visible)
- `CHIP_FLOAT_Y` — orbital height of number balloons

### Board generation

`Board` (`src/game/board/board.ts`) takes an optional `seed` to deterministically place the standard 19-tile bag (`STANDARD_LAND_BAG`) and number bag (`STANDARD_NUMBER_BAG`) from `tile-types.ts`. Desert is fixed at the center. The seed → RNG converter is a tiny LCG inline in `board.ts`. Water tiles and harbors are *not* part of `Board` — they live in `World` / `HarborSystem`.

### Player areas

Four `PlayerArea` instances rotate around the Y-axis by `seat * π/2`. Each builds an "arsenal" (roads/settlements/cities) at fixed local coordinates plus a hand of resource + dev cards. Card textures are generated procedurally via canvas in `src/game/cards/textures.ts`. Player names/labels are German (`PLAYER_NAME_DE`, `RESOURCE_LABEL_DE`, `DEV_LABEL_DE`).

### Hover events and userData convention

The hover system identifies targets by walking up the parent chain looking for `userData['kind']` ∈ `{'harbor', 'chip', 'card'}`. Adding a new hoverable means: (1) tag the `Object3D` with `userData['kind']` and a payload reference, (2) push it into the hoverables list assembled in `GameEngine`'s constructor, (3) extend `HoverTarget` in `interaction/hover.ts`.
