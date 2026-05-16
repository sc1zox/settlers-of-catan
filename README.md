# Settlers of Catan (Browser)

Nx-Monorepo mit Angular-Frontend (Three.js), NestJS-API (Socket.IO) und gemeinsamen TypeScript-Libs. Lobby, Spielzustand und Echtzeitaktionen laufen über Websockets; HTTP dient vor allem Session und Bootstrap.

## Voraussetzungen

- **Node.js** ≥ 24.10 (siehe `package.json` → `engines`)
- **npm** (Workspace nutzt `npm@11.x`)

## Schnellstart (lokal)

```bash
npm install
npm start
```

Das startet parallel:

- **API** unter `http://localhost:3000`
- **Web-Client** unter `http://localhost:4200`

Einzeln:

```bash
npm run start:api
npm run start:client
```

## Docker Compose (optional)

```bash
docker compose up
```

Startet u. a. **Redis**, **Coturn**, **LiveKit** sowie die Dev-Container für **API** (`:3000`) und **Web** (`:4200`). Über Bind-Mounts sollten `NX_DAEMON=false` und `CHOKIDAR_USEPOLLING=1` gesetzt sein (im Compose bereits vorgesehen), damit Watchers zuverlässig laufen.

Produktionsnahe Variablen sind in `deploy/env.prod.example` skizziert.

## Wichtige npm-Skripte

| Skript | Zweck |
| --- | --- |
| `npm run build` | Production-Build von `catan-client` und `catan-api` |
| `npm run watch` | Inkrementeller Dev-Build nur Client |
| `npm test` | Vitest (Unit-Tests, aktuell Client) |
| `npm run lint` | ESLint über alle Projekte inkl. Modulgrenzen |
| `npm run format` / `format:check` | Prettier für `apps/**` und `libs/**` |

## Repository-Layout

| Pfad | Inhalt |
| --- | --- |
| `apps/catan-client` | Angular 21 (Standalone, Zoneless), 3D-Tisch über Three.js |
| `apps/catan-api` | NestJS 11, REST (`/api/…`), Socket.IO-Namespace `/game` |
| `libs/api-interfaces` | Wire-Format: Enums, DTOs, Socket-Events — **gemeinsame Kontrakte** für Client und Server |
| `libs/shared/game-field` | Brettlogik (Topologie,/generierte Placements), nutzbar von beiden Seiten |

Neue Socket-Events, Fehlercodes oder DTOs gehören nach **`@catan/api-interfaces`**, damit beide Enden dieselben Typen importieren.

## Architektur kurz

- **Session**: JWT-basierte Spielersitzung (Refresh über HTTP); siehe `BearerSessionGuard` und Session-Module in der API.
- **Spiel**: Lobby und Match-Flow in Feature-Services; Zustandsänderungen werden nach außen per **`FullState`** verteilt (Single Source of Truth für den Client).
- **Video/WebRTC**: LiveKit + Coturn sind im Compose vorhanden; Client nutzt `livekit-client`.

Ausführliche Konventionen und Dateiverweise für Agents und Maintainer stehen in **`CLAUDE.md`** im Repo-Root.

## Tests

End-to-End-Tests sind derzeit nicht Teil des Standard-Setups. Unit-Tests:

```bash
npm test
```

Gezielt filtern (Beispiel):

```bash
npx nx test catan-client --test-name-pattern="App"
```
