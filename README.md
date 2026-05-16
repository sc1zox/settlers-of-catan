# Settlers of Catan (Browser Edition)

Ein modernes, browserbasiertes Catan-Erlebnis mit Echtzeit-Multiplayer, 3D-Spielbrett und klarer TypeScript-Architektur.

## Warum dieses Projekt?

- Echte Multiplayer-Interaktion über Socket.IO statt Polling.
- 3D-Spieloberfläche mit Three.js und klarer Trennung zwischen UI und Engine.
- Gemeinsame Typen und Wire-Contracts für Client und Server aus einer Quelle.
- Feature-basierte Struktur im Monorepo, gut für langfristige Wartbarkeit und Refactoring.
- Guter Playground für Echtzeitlogik, State-Machines und Multiplayer-UX.

## Was du sofort bekommst

- Lobby und Match-Flow mit serverseitig autoritativem Spielzustand.
- Build-/Trade-/Robber-Interaktionen als echte In-Game-Aktionen.
- Angular-Client (zoneless) und NestJS-API in einem Nx-Workspace.
- Entwicklungssetup lokal oder per Docker Compose.
- Solides Linting, Formatierung und testbare Teilbereiche.

## Tech Stack

- Frontend: `Angular 21`, `Three.js`, `RxJS`
- Backend: `NestJS 11`, `Socket.IO`
- Monorepo: `Nx`
- Shared domain/contracts: `libs/api-interfaces`, `libs/shared/game-field`
- Optionales Infra-Setup (Compose): `Redis`, `LiveKit`, `Coturn`

## Schnellstart

### Voraussetzungen

- `Node.js` >= `24.10`
- `npm` (Workspace nutzt `npm@11.x`)

### Lokal starten

```bash
npm install
npm start
```

Danach laufen:

- API: `http://localhost:3000`
- Web: `http://localhost:4200`

Einzeln starten:

```bash
npm run start:api
npm run start:client
```

## Docker Compose (optional)

```bash
docker compose up
```

Compose startet die Web/API-Container plus zusätzliche Services wie Redis, Coturn und LiveKit. Das ist hilfreich, wenn du Integrationspfade lokal mit realistischer Umgebung testen willst.

Produktionsnahe Umgebungsvariablen findest du in `deploy/env.prod.example`.

## Nützliche Commands

```bash
npm run build          # Build von catan-client + catan-api
npm run watch          # Inkrementeller Dev-Build für den Client
npm test               # Unit-Tests (aktuell primär Client)
npm run lint           # ESLint inkl. Nx Modulgrenzen
npm run format         # Prettier Formatierung
npm run format:check   # Prettier Check
```

## Projektstruktur

- `apps/catan-client`: Angular-Frontend und Three.js-Engine
- `apps/catan-api`: NestJS-Backend (REST + Socket Gateway)
- `libs/api-interfaces`: DTOs, Events, Enums, gemeinsame Verträge
- `libs/shared/game-field`: geteilte Brett-/Topologie-Logik

Wichtig: Alles, was über die Leitung geht (Events, DTOs, Error-Codes, Konstante Schlüssel), gehört in die Shared Contracts unter `libs/`.

## Architektur in 60 Sekunden

- Der Server ist für Spielregeln und Übergänge zuständig (autoritativer Zustand).
- Der Client rendert und interagiert auf Basis von `FullState`.
- Socket-Events treiben Echtzeitaktionen.
- HTTP kümmert sich primär um Session, Bootstrap und Token-Refresh.

Das Ergebnis: weniger inkonsistente States, klare Verantwortlichkeiten, gut debuggbar.

## Development Workflow

Empfohlener Ablauf:

1. Branch erstellen.
2. Änderung klein und fokussiert halten.
3. Lint/Test/Build lokal laufen lassen.
4. Merge Request mit kurzer Begründung erstellen.

Vor dem Merge:

```bash
npm run lint
npm test
npm run build
```

## Nächste sinnvolle Ausbauten

- UI/UX-Polish im Session- und HUD-Bereich.
- Weitere Tests rund um Match-Flow und Engine-Integration.
- Performance-Tuning bei Rendering und Szene-Updates.
- Dokumentation erweitern (`docs/`) oder Developer-Onboarding verbessern.

## Roadmap (kurz)

- Mehr Gameplay-Polish und visuelles Feedback.
- Ausbau von Testabdeckung und Qualitätssicherung.
- Weitere Multiplayer- und Social-Features.
- Bessere Onboarding-Pfade.

## Motivation zum Ausprobieren

Das Projekt liefert nicht nur ein Spiel, sondern ein vollständiges, modernes Realtime-Webprojekt:

- spannend genug, um dran zu bleiben
- strukturiert genug, um sauber zu entwickeln
- so aufgebaut, dass neue Features sauber integriert werden können

Wenn du Catan magst oder Multiplayer-Architektur lernen willst, ist das ein sehr guter Startpunkt.
