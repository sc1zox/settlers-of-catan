# End-to-End-Audit: Spielablauf für 4 Spieler in einer Lobby

Geprüfter Stand: `master` am 2026-05-15.

Auditiert wurde: 4 Menschen joinen über denselben Lobbycode → Initialisierungsphase → regelgerechter Spielablauf → Win Condition. Geprüft wurde der Server-FSM (`apps/catan-api`), die geteilten Wire-DTOs (`libs/api-interfaces`) und der Client-Phase-Sync (`apps/catan-client`).

## Fazit

Für 4 dauerhaft verbundene Spieler, die mit dem gleichen Lobbycode joinen, läuft Setup → Main → Win **regelgerecht und einbahnfrei** durch. Die State Machine in `TurnStateMachine` erzwingt jeden Übergang über eine eigene Methode, Ad-hoc-Phasenwechsel sind nicht möglich, Aktionen außerhalb der erlaubten Phase werden konsistent mit `WrongPhase` abgelehnt.

## 1) Lobby-Beitritt mit gemeinsamem Code

- `LobbyService.joinLobby` (`apps/catan-api/src/app/game/lobby/lobby.service.ts:67`) ruft `RedisLobbyStoreService.resolveOrCreateCanonicalLobbyId` (`apps/catan-api/src/app/infrastructure/redis/redis-lobby-store.service.ts:32`).
- Normalisierter Lobbycode wird in Redis per `SET … NX` auf eine UUID gemappt; spätere `GET`-Aufrufe liefern dieselbe UUID. Alle 4 Joiner landen in derselben `LobbyRuntime` (in-memory Map in `LobbyService`).
- Sitze werden über `nextFreeSeat()` clockwise vergeben (`lobby-runtime.ts:125`): North → East → South → West.
- Erster Joiner wird Admin (`lobby.service.ts:88-90`).
- Pro Join: `liveKit.ensureRoom` + JoinToken; Server emittiert `LobbyJoined` an den Joiner und anschließend `FullState` an alle Mitglieder.

## 2) Setup-Phase (`SetupForward` → `SetupBackward` → `Rolling`)

- `MatchFlowService.startLobby` (`match-flow.service.ts:29`) prüft Admin-Identität + min. 2 Spieler; `fsm.onLobbyStarted()` setzt Phase auf `SetupForward`; `currentSeat = firstTurnSeat = activeSeats[0]` (= North).
- Pro Sitz: Settlement (`BuildActionService.buildSettlement`, `build-action.service.ts:22`) → `pendingSetupRoadSeat/FromVertexId` werden gesetzt; danach Road (`buildRoad:62`).
- `applySetupForwardTransition` (`turn-flow.service.ts:32`) inkrementiert Setup-Counter und setzt nächsten Sitz. Beim letzten Forward-Sitz (West) → `fsm.onSetupForwardCompleted()` + `currentSeat = West` (doppelter Zug korrekt).
- Backward: West platziert zweites Settlement → `pendingSetupResourceSeat` wird markiert; Road triggert `economy.grantSetupResourceFromSettlement` (1 Ressource je angrenzendem Land-Hex).
- `applySetupBackwardTransition` (`turn-flow.service.ts:48`) läuft rückwärts bis Index 0 → `onSetupCompleted()` → Phase `Rolling`, `currentSeat = activeSeats[0]`.

## 3) Hauptschleife (`Rolling → Trading → Building → EndTurn`)

`GameService.rollDice` (`game.service.ts:180`) → `MatchFlowService.rollDice` würfelt, dann `EconomyService.resolveDiceRoll` (`economy.service.ts:30`):

- **Nicht-7:** Produktion via `applyResourceProduction` (Robber-Tile übersprungen, City = 2 Karten). `fsm.onDiceResolved(false, false)` → `Trading`.
- **7:** `pendingRobberDiscardSeats = collectRobberDiscardSeats` (alle mit > 7 Karten). `fsm.onDiceResolved(true, hasPending)`:
  - Pending vorhanden → `RobberDiscard`. Jeder muss exakt `floor(total/2)` abwerfen (`robber.service.ts:27`); wenn Liste leer → `onDiscardRoundResolved()` → `RobberMove`.
  - Kein Pending → direkt `RobberMove`.
- `RobberService.moveRobber` (`robber.service.ts:72`) prüft Land-Hex und Bewegung-zu-anderem-Hex, sammelt Opfer; Klau via `applyRobberMove` / `stealRandomResource`. `fsm.onRobberMoved()` → `Trading`.

`Trading`:

- Bank-Trade (`economy.service.ts:68`), Spieler-Trade (`trade-actions.service.ts:24` — strikt `phase === Trading` + `currentSeat`), Knight / Year-of-Plenty / Monopoly / Road-Building spielbar.
- `finishTrading` (`match-flow.service.ts:68`) → `onTradingFinished()` → `Building`. Offene Trades werden über `expireOpenOffersForLobby` invalidiert.

`Building`:

- Settlement / Road / City / DevCard kaufen — alle prüfen Kosten + Legalität.
- `endTurn` (`match-flow.service.ts:58`) → `nextSeat` (clockwise) + `lastDiceRoll = null` + `resetTurnDevCardState` + `onTurnEnded()` → `Rolling`.

## 4) Win Condition

`applyPostActionScoring` (`scoring.util.ts:41`) läuft nach **jeder** VP-relevanten Aktion (Settlement, Road, City, jeder Dev-Card-Buy/Play).

Reihenfolge:

1. Longest Road (≥ 5 und länger als bisheriger Halter).
2. Largest Army (≥ 3 gespielte Knights).
3. Winner-Check `totalVictoryPoints ≥ 10`.

`getTotalVictoryPoints` summiert sichtbare VP + versteckte VP-Cards + +2 Longest Road + +2 Largest Army. Bei Sieger setzt `fsm.onWinnerDeclared()` Phase auf `Finished` aus **jeder** Phase heraus (idempotent). `LobbyService.assertLobbyOpen` (`lobby.service.ts:61`) sperrt danach alle Handler.

## Beobachtungen (kein Happy-Path-Blocker)

1. **`totalVictoryPoints` ist in `LobbyFullStatePayload.players` für alle Viewer sichtbar** (`lobby.service.ts:213`). Damit kann jeder Mitspieler durch Vergleich mit `visibleVictoryPoints` versteckte VP-Karten erschließen — Info-Leak gegen die Catan-Regel, kein Flow-Bug. Fix-Idee: für fremde Viewer auf `visibleVictoryPoints` clampen.
2. **Mid-Setup-Disconnect**: Wenn der aktuelle Sitz nach 60 s Grace entfernt wird, werfen `applySetupForward/BackwardTransition` `NotYourTurn`, weil `currentIndex < 0`. Die Hauptphase wird durch `nextSeat` (`turn-flow.service.ts:25`) abgefangen, das Setup nicht. Für 4 dauerhaft verbundene Spieler kein Problem; Robustheitslücke.
3. **`bankTrade` nur in `Trading`** (`economy.service.ts:75`), nicht in `Building` — Designwahl, weicht aber leicht von der Originalregel ab.
4. **Multi-Instance-API teilen `LobbyRuntime` nicht** — die Map ist Prozess-lokal, Redis kennt nur den Alias. Bei `npm start` / `docker compose` (Single-Instance) irrelevant; in einem horizontal skalierten Deployment würden Spieler auf unterschiedlichen API-Pods in getrennten Game-States enden.
