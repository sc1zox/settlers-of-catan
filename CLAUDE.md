# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Run from the repo root. The workspace is Nx 21; scripts in `package.json` wrap `nx`.

- `npm start` — runs both apps concurrently (Nest API on :3000 + Angular client on :4200) via `concurrently`. `npm run start:client` / `start:api` run them individually.
- `npm run build` — Nx `run-many -t build` over `catan-client,catan-api`.
- `npm run watch` — incremental dev build of the client only.
- `npm test` — Vitest via Angular's `@angular/build:unit-test` (jsdom env). Only the client has tests today. To filter: `npx nx test catan-client --test-name-pattern="App"`.
- `npm run lint` — ESLint across all four projects (`catan-client`, `catan-api`, `shared-game-field`, `api-interfaces`).
- `npm run format` / `format:check` — Prettier across `apps/**` and `libs/**`.
- `docker compose up` — brings up `api` (port 3000) and `web` (port 4200) containers; both mount the repo and invoke `nx serve` inside. `NX_DAEMON=false` and `CHOKIDAR_USEPOLLING=1` are required for the watcher to work over the bind mount.

TypeScript is strict + `noPropertyAccessFromIndexSignature` + `noImplicitOverride` + `noImplicitReturns`. Bracket access on index signatures (`obj['kind']`, `process.env[ProcessEnvKey.Port]`) is intentional — don't "fix" to dot access.

Workspace path aliases (declared in `tsconfig.base.json`):
- `@catan/api-interfaces` → `libs/api-interfaces/src/index.ts`
- `@catan/shared-game-field` → `libs/shared/game-field/src/index.ts`

## Monorepo layout

```
apps/
  catan-client/   Angular 21 standalone + Three.js scene
  catan-api/      NestJS 11 with @nestjs/platform-socket.io and Swagger
libs/
  api-interfaces/      wire-format enums, DTOs, payload types — imported by both sides
  shared/game-field/   tile bag, board generation, hex layout — used by both runtime board topologies
```

The two libs are the *only* sanctioned coupling between client and server. Any new socket event, REST DTO, error code, env key, or constant string that travels over the wire must live in `@catan/api-interfaces` — both ends import the same enum value rather than ad-hoc string literals.

## Server (`apps/catan-api`)

Nest bootstraps in `apps/catan-api/src/main.ts`: global `ValidationPipe` (whitelist + forbid non-whitelisted + implicit type conversion), CORS pulled from `CORS_ORIGINS` via `applyHttpCorsFromEnv`, Socket.IO `IoAdapter`, REST under the `api/` prefix (`ApiGlobalPathPrefix.Rest`), Swagger UI at `/docs`. Builds with webpack (`apps/catan-api/webpack.config.js`) — *not* the Nx default — and serves via `@nx/js:node`.

### HTTP surface

`SessionModule` (`session/bootstrap`, `session/refresh`, `session/ping`) issues short-lived access JWTs + opaque refresh tokens. Tokens are signed with `PLAYER_SESSION_JWT_SECRET`; TTLs come from `PLAYER_SESSION_ACCESS_TTL` / `PLAYER_SESSION_REFRESH_TTL`. `BearerSessionGuard` is registered globally and reads `Authorization: Bearer <jwt>`; the `@Public()` decorator opts a controller method out.

Every successful response is wrapped by `ApiStandardHttpInterceptor` into `{ data, requestId }` (`ApiEnvelope<T>` in `api-envelope.dto.ts`). On the client side, `apiEnvelopeInterceptor` unwraps it — controllers and services do *not* see the envelope shape.

### Game state

`GameModule` (`game/game.module.ts`) wires together one Nest module per game concern. The in-memory `Map<lobbyId, LobbyRuntime>` lives in `LobbyService`, *not* `GameService` — there is no persistence yet. The pieces:

- `LobbyRuntime` (`game/lobby-runtime.ts`) — per-lobby state: players, seats, settlements, roads, robber position, dev deck, FSM. Each lobby has its own RNG seed; tile placements come from `makeStandardLandPlacements(seed)` in the shared `game-field` lib.
- `TurnStateMachine` (`game/turn-state-machine.ts`) — single-method-per-transition FSM over `GamePhase`. *All* phase changes go through this class; ad-hoc `lobby.fsm.setPhase(...)` calls in handlers bypass the assertions and should be avoided.
- `createBoardTopology(tiles)` (`game/board-topology.ts`) — derives vertex/edge IDs from cube coordinates; the resulting IDs are the contract for `BuildSettlement` / `BuildRoad` payloads and are echoed back to the client in `LobbyFullStatePayload.{vertexIds,edgeIds}`. Edge IDs are formatted `"<vertexA>|<vertexB>"` (the client splits on `|`).
- `scoring.util.ts` (longest road / largest army / VP totals), `robber.util.ts`, `harbor-rate.util.ts` — pure functions invoked by the services below.

**Service decomposition.** `GameService` is a *thin facade*: each public method resolves the lobby, asserts it's open, delegates to a feature service, then broadcasts `FullState`. The actual rules live in feature services, each with its own `*.module.ts` that `GameModule` imports:

- `LobbyService` — owns the lobby `Map`; join/disconnect/reconnect grace, seat assignment, `toFullState` (including the per-viewer `legal*Ids` arrays), `broadcastFullState`, `requireLobby` / `assertLobbyOpen`.
- `MatchFlowService` — `startLobby`, `rollDice`, `finishTrading`, `endTurn` — the phase-to-phase progression of a match.
- `BuildActionService` — `buildSettlement`, `buildRoad`, `buildCity`, `playRoadBuilding` (placement legality + piece placement).
- `EconomyService` — dice-roll resource production, `buyDevCard`, monopoly / year-of-plenty / bank-trade resource movement.
- `RobberService` — robber discard, `moveRobber`, `playKnight`.
- `TurnFlowService` — turn order / seat rotation / setup-phase transitions.
- `TradeService` + `TradeActionsService` — player-to-player trade lifecycle (propose / accept / reject). The gateway calls `TradeActionsService` directly rather than through `GameService`.
- `DemoBotService` — the `KnownLobbyId.DemoClient` (`'demo'`) lobby auto-fills with bots and autoplays the setup phase.
- `GameActionValidationService` — shared assertions (`assertPhase`, `assertCurrentPlayer`, legal settlement/road/city checks) injected into the feature services.

When adding a server action, extend the matching feature service (or add a new module), then add a thin delegating method on `GameService` and a `@SubscribeMessage` handler on the gateway.

### Socket.IO gateway

`GameGateway` (`game/game.gateway.ts`) lives on namespace `/game` (`SocketGatewayNamespace.Game`). Auth happens in `handleConnection`:

1. Read `handshake.auth.accessToken` (preferred) — verify JWT via `PlayerSessionJwtService` → `sessionId`.
2. Fallback: `Authorization: Bearer` header on the handshake.
3. Legacy fallback: `handshake.auth.sessionToken` as a raw UUID.
4. None of those? Disconnect.

The resolved `sessionId` becomes the player's stable identity (`LobbyPlayerSlot.sessionToken`) and is mapped to the current `socket.id` in `SocketConnectionRegistry`. Disconnects start a grace timer in `LobbyRuntime`; reconnecting with the same sessionId re-binds without losing the seat.

Client→server events are `GameSocketClientEvent.*`, server→client are `GameSocketServerEvent.*` (both in `libs/api-interfaces/src/lib/socket-events.ts`). After any state-changing handler, the gateway broadcasts `GameSocketServerEvent.FullState` to all sockets in `formatSocketIoLobbyRoomId(lobbyId)` — the client treats `FullState` as the source of truth; `GameDelta` is informational only.

`LobbyFullStatePayload` is computed *per viewer*: alongside the static `vertexIds` / `edgeIds`, it carries `legalSettlementVertexIds`, `legalRoadEdgeIds`, `legalCityVertexIds`, and `legalRoadBuildingEdgeIds` — the moves *that recipient* may legally make right now (empty when it isn't their turn / wrong phase). The client renders ghost build-spots straight from these arrays; it does not re-derive legality.

Errors thrown inside a handler are caught and emitted as `ActionRejected` with a code from `ActionRejectCode` (`Error.message` strings are mapped back to enum values via `asRejectCode` / `GameService.describeError`).

## Client (`apps/catan-client`)

Angular 21 standalone components, **zoneless change detection** (`provideZonelessChangeDetection()` in `app.config.ts`) — there is no `NgZone` and no `ngZone.runOutsideAngular` boundary anymore. Signals + `rxResource` drive everything.

### HTTP & socket plumbing

`app.config.ts` registers three interceptors in order: `sessionBearerInterceptor` (attaches `Authorization: Bearer <accessToken>`), `apiEnvelopeInterceptor` (unwraps `{data,requestId}`), `sessionHttpErrorInterceptor` (catches 401 and refreshes). `PlayerSessionService` owns access/refresh tokens, persisted under `ClientStorageKey.AccessToken` / `RefreshToken` in localStorage.

`GameSocketService` (`app/game-socket.service.ts`) is the only socket.io-client and exposes RxJS subjects (`fullState$`, `tradeUpdated$`, etc.). `GameStateResource` (`app/game/game-state.resource.ts`) wraps these in `rxResource<LobbyFullStatePayload | undefined, ...>` so components consume the lobby as a signal-shaped resource. When the lobby changes shape, every `computed(...)` in `LobbyShellComponent` re-derives — do not mutate payloads in place.

`LobbyShellComponent` (`app/lobby-shell.component.ts`) is the entry UI: sign-in → join lobby → in-game. The component owns all reactive forms and an enormous block of `computed<boolean>` capability flags (`canBuildSettlement`, `canRollDice`, …). When adding a new player action, follow the same pattern: define a `can…` signal that combines `lobbyUiState()`, `selfSeat()`, and the phase, and a corresponding handler that delegates to `GameStateResource`. It also hosts the interactive DOM overlays driven by signals — `BuildConfirmPopoverComponent`, `DiscardModalComponent`, `DevCardModalComponent`, `TradePanelComponent`, `RobberVictimPopoverComponent` (all under `app/game-canvas/`). `app.ts` is intentionally tiny (`<app-lobby-shell />`).

New per-feature client code goes under `app/features/<feature>/` (e.g. `features/spectator-camera/` — a root `SpectatorCameraService` signal plus a toggle component; `GameCanvasComponent` mirrors its `mode()` into `engine.setSpectatorCameraMode()` via an `effect`).

### Angular ↔ Three.js boundary

`GameCanvasComponent` (`app/game-canvas/game-canvas.ts`) is the only bridge. It:
- Instantiates `GameEngine` in `ngAfterViewInit` and disposes in `ngOnDestroy` (no zone wrapping — zoneless).
- Registers callbacks on the engine that push into Angular signals: `setHoverHandler` → `harborTooltip` / `cardTooltip`; `setDiceResultHandler` → `diceOverlay`; `setFocusChangeHandler` → fullscreen backdrop; plus the build-mode callbacks (`setArsenalBuildHandler`, `setBuildSpotPickHandler`, `setRobberTilePickHandler`, `setBuildModeCancelHandler`). New DOM-overlay UI must flow through one of these callbacks; never read from `GameEngine` from a template.
- Hosts the passive overlays (`DiceOverlayComponent`, `HarborTooltipComponent`, `CardTooltipComponent`); the *interactive* overlays live on `LobbyShellComponent`.

### `GameEngine` (`apps/catan-client/src/game/engine.ts`)

Owns the scene graph and lifecycle. Composes — does not subclass — these subsystems, each a self-contained `Group`-bearing class with `update(dt, t)` and `dispose()`:

- `Table` — tabletop slab the disc sits on
- `World` — water surface (everything outside the land disc)
- `Board` — the 19 land hex tiles
- `HarborSystem` — 9 harbor buildings on the outer water ring
- `PlayerArea[]` — four seats with cards + figure arsenals
- `DiceTray` — two dice in a corner of the table; `rollBoth()` invokes the result handler when the dice settle
- `BoardBuildings` (`board/buildings.ts`) — placed settlements/roads/cities rendered from `LobbyFullStatePayload`, with pop-in via `BuildAnimation`
- `BuildPreview` (`board/build-preview.ts`) — translucent ghost figures for the current build mode

`HoverSystem` raycasts against a flat array of "hoverable" `Object3D`s; the set is **rebuilt** (`hover.setHoverables(...)`) whenever the board or hands change shape, not just assembled once. Per-frame in the RAF loop: `board.update → world.update → diceTray.update → controls.update → updateFocusedCards → players.update → hover.update → renderer.render`.

Disposal is strict: every subsystem disposes its geometries and materials. Adding new GPU resources requires wiring them into the matching `dispose()`.

#### Focused-card mode

Clicking a hand card calls `handleCardClick`, which puts every card in the same `groupKey` into `'focused'` mode. `updateFocusedCards()` repositions the group every frame as a horizontal fan locked to the camera basis, sized so the largest member fits a target fraction of the view (`FOCUS_FILL_RATIO_HAND` / `FOCUS_FILL_RATIO_SINGLE`). A second click on any member, or clicking the backdrop, calls `clearFocusedCard()`. All the scratch `Vector3`/`Quaternion` fields on `GameEngine` are reused per frame on purpose — don't allocate inside the loop.

### Hex coordinate system

There are two parallel hex coordinate systems — keep them straight:

- **Shared axial grid** — `libs/shared/game-field/src/lib/hex-layout.ts` defines pointy-top **axial** `(q, r)` on the x/z plane, `axialToWorldXZ`, `hexRing`, `hexDisc`, plus the internal `RING_WALK_DIRECTIONS` ordering used to walk a ring. `HEX_SIZE = 2.4` is the canonical hex radius. The client thinly re-exports these from `apps/catan-client/src/game/board/hex.ts` (which adds an `axialToWorld → Vector3` wrapper for Three.js).
- **Harbor placement** — `apps/catan-client/src/game/world/harbors.ts` defines its own `NEIGHBOR_DIRS` ordering for orienting harbor docks. That ordering is *not* the same as the shared `RING_WALK_DIRECTIONS` — don't conflate them.
- **Server topology** — `apps/catan-api/src/app/game/board-topology.ts` converts axial to **doubled cube coordinates** (`x2,y2,z2`) to compute vertex/edge identity. Vertex IDs are strings keyed on the doubled-cube coordinate; edges are `"<vertexA>|<vertexB>"` with a deterministic ordering.

Three Y-axis constants in the client are load-bearing:
- `TILE_HEIGHT = 1.0` — slab top
- `WATER_LEVEL_Y = -0.4` — water surface (lower than tile top so cliffs are visible)
- `CHIP_FLOAT_Y` — orbital height of number balloons

### Tile hierarchy

`Tile` (abstract, `src/game/tiles/tile.ts`) builds the slab + outline + floating number-chip sprite + projection beam, and exposes hover state via `setChipHovered`. Subclasses (`ForestTile`, `FieldsTile`, etc.) layer on decorations and animation; **they must call `super.update(dt, t)`** or the chip stops bobbing. `TileFactory.createTile()` dispatches on `TileType` (the enum lives in `@catan/shared-game-field` and is re-exported from `@catan/api-interfaces` for the wire DTO).

### Board generation

`Board` (`src/game/board/board.ts`) takes an optional `seed` and runs the standard 19-tile bag (`STANDARD_LAND_BAG`) and number bag (`STANDARD_NUMBER_BAG`) from `tile-type.ts`. Desert is fixed at the center. The seed→RNG converter is a tiny LCG that lives **only** in `libs/shared/game-field/src/lib/board-generation.ts` (`seedToRng`); the server uses the same function via `makeStandardLandPlacements`, so a given seed produces identical layouts on both sides.

Water tiles and harbors are *not* part of `Board` — they live in `World` / `HarborSystem` on the client.

### Player areas and hover convention

Four `PlayerArea` instances rotate around the Y-axis by `seat * π/2`. Each builds an "arsenal" (roads/settlements/cities) at fixed local coordinates plus a hand of resource + dev cards. Card textures are generated procedurally via canvas in `src/game/cards/textures.ts`. Labels/names are German (`PLAYER_NAME_DE`, `RESOURCE_LABEL_DE`, `DEV_LABEL_DE`); user-facing UI strings throughout the client are German.

`HoverSystem` walks up the parent chain looking for `userData[SceneUserDataKey.Kind]`, a `SceneObjectKind` enum value (in `@catan/api-interfaces`, alongside `SceneUserDataKey` for the other userData keys and `scene-hover-handlers.ts` for the callback signatures). Kinds in use:
- `Harbor` and `Chip` produce a `HoverTarget` (tooltip). `Chip` is also click-only during robber placement (`setTileClickHandler`).
- `Card` produces a hover *and* is clickable (drives focus mode).
- `Die` is click-only (rolls both dice via `setDieClickHandler`).
- `BuildSpot` (a ghost figure) and `Arsenal` (a stash figure) drive the build-mode flow — hover/click handlers, not tooltips.

Adding a new hoverable means: (1) tag the `Object3D` with `SceneUserDataKey.Kind` (+ `BuildKind` / `BuildId` / payload refs as needed), (2) ensure it's in the array passed to `hover.setHoverables(...)`, (3) if it emits a tooltip, extend the `HoverTarget` union in `interaction/hover.ts` and the branch in `HoverSystem.update`.

### Build interaction flow

Build mode is **owned by Angular**, not the engine. The server sends the legal-move arrays in `LobbyFullStatePayload`; the flow: player clicks an `Arsenal` figure → `ArsenalBuildHandler` → `LobbyShellComponent` enters build mode for that `BuildKind` → the engine shows `BuildPreview` ghosts at the legal vertex/edge ids → player clicks a `BuildSpot` ghost → `BuildSpotPickHandler` → `BuildConfirmPopoverComponent` ("Hier bauen?") → confirm emits the socket event. `board-coords.ts` maps server vertex/edge id strings to world positions (purely topological — seed-independent).

## Conventions worth knowing

- Enum-style constants: prefer a TypeScript `enum` in `@catan/api-interfaces` over inline string literals for anything that travels over the wire or appears in storage keys. Examples already in place: `ProcessEnvKey`, `ClientStorageKey`, `KnownLobbyId`, `SocketAuthPayloadKey`, `ApiEnvelopeFieldKey`, `HttpHeaderNameLowercase`.
- ESLint disables `@typescript-eslint/prefer-for-of` workspace-wide — classic `for (let i = 0; i < arr.length; i++)` is idiomatic here, especially in hot paths inside `GameEngine`.
- Angular component selectors use the `app-` prefix; directives use camelCase (`app-eslint` config).
- The client environment file (`apps/catan-client/src/environments/environment.ts`) points at `DevelopmentApiOrigin.LocalHttp` — there is no production environment.ts yet.
