# Code-Quality-Bericht

Geprüfter Stand: `master` am 2026-05-21.

Dieser Bericht hält fest, wo die Codebase noch hinter den in `CLAUDE.md`
("Code quality expectations") formulierten Erwartungen zurückbleibt. Maßstab
sind **thematische Kapselung**, **Separation of Concerns** und
**Wiederverwendbarkeit** — Zeilenzahlen sind nur ein Indikator, kein Ziel.

## Gesamteindruck

Die Codebase ist überwiegend in gutem Zustand: strikte TypeScript-Konfiguration
ohne `any` / `@ts-ignore` / `as unknown as` (0 Treffer), keine streunenden
`console.*`-Aufrufe, konsequente Domänen-Kapselung über Feature-Module (Server)
und Subsysteme (Client). Alle fünf Pass-Through-Facades gelöscht,
`LobbyTimerRegistry` aus `LobbyRuntime` extrahiert, Demo-Bot-Callbacks
dedupliziert, Scoring-Tests vollständig. Die zweite Audit-Runde (Befunde
#11–#20) ist ebenfalls vollständig abgearbeitet: Duplikationen bereinigt,
Harbor-Cache eingeführt, Throw-as-Control-Flow eliminiert, Presentation-State
aus `LobbyRuntime` entfernt, Client-Patterns vereinheitlicht.

---

## Erledigte Punkte (seit erstem Report)

| # | Titel |
|---|-------|
| ~~1~~ | Keine Tests für die Siegpunkt-Logik — `scoring.spec.ts` mit 16 Specs ✅ |
| ~~2~~ | `NODE_ENV` umging den `ProcessEnvKey`-Enum — `session-cookie.util.ts` korrigiert ✅ |
| ~~3~~ | Fünf tote Pass-Through-Facades — gelöscht, Handler rufen `GameService` direkt ✅ |
| ~~5~~ | Demo-Bot-Callbacks in `GameService` dreifach dupliziert — `buildSetupAutoplayPort()` / `buildMainGameCallbacks()` eingeführt ✅ |
| ~~6~~ | `LobbyRuntime` God-Object — Timer nach `LobbyTimerRegistry` ausgelagert ✅ |
| ~~7~~ | Hand-Signature-Tests überfällig — `resource-hand.spec.ts` mit 14 Specs für `computeHandSignature` / `computeOpponentHandSignature` ✅ |
| ~~8~~ | `AvatarSeat` kapselt Nameplate-Rendering — Canvas-2D-Methoden nach `avatar-textures.ts` ausgelagert ✅ |
| ~~9~~ | Webcam-Pre-Join-Logik in `SessionLobbyFlowService` — `tryPrime()` / `canJoinWithWebcam()` nach `LobbyLiveKitService` verschoben ✅ |
| ~~11~~ | `countTotalResources` dreifach dupliziert — alle auf `countResourceCards` aus `public-player-resources.util.ts` vereinigt ✅ |
| ~~12~~ | `isPlacementLegal` Throw-as-Control-Flow — `canX`-Methoden eingeführt, `computeLegalMoves` und Demo-Bot portiert ✅ |
| ~~13~~ | Harbor-Geometrie pro Broadcast neu berechnet — `computeHarborVertexSets` exportiert, Cache in `LobbyService`; `findOuterSideDirection` kommentiert ✅ |
| ~~14~~ | `lastAnnouncedX` Presentation-State auf `LobbyRuntime` — nach `bonusAnnounceState` Map in `LobbyService` verschoben ✅ |
| ~~15~~ | `emptyResourceBag()` stateless Instanzmethode — `emptyMutableResourceRecord()` in `public-player-resources.util.ts` eingeführt, Methode entfernt ✅ |
| ~~16~~ | `mapLobbyFullStateToSceneState` doppelt aufgerufen in `GameCanvas` — `currentSceneState` computed eingeführt ✅ |
| ~~17~~ | Zwei Codepfade für Engine-Initial-Setup in `GameCanvas` — `seedEngineSettings()` extrahiert ✅ |
| ~~18~~ | `TradeSessionService` raw `.subscribe()` — auf `takeUntilDestroyed` migriert ✅ |
| ~~20~~ | `TradeSocketFacade` irreführender Name + Bot-Logik im falschen Layer — nach `TradeGatewayService` umbenannt, Bot-Autoresponse nach `DemoBotService.respondToTradePropose()` verschoben ✅ |

---

## Zuerst beheben

### 4. `engine.ts` trägt zu viele Domänen

`apps/catan-client/src/game/engine.ts` (~1060 Zeilen) ist der einzige Ort, an
dem vier thematisch verschiedene Concerns zusammenlaufen:

| Concern | Symptom |
|---------|---------|
| **Lobby-State-Sync** | `applySceneState` (~130 Zeilen imperativer Diff-Code) |
| **Build-Mode-Controller** | `showBuildSpots`, `updateActivatedArsenalFigure`, `canFlyInArsenalFigure`, `startArsenalFlyIn`, `resolveLegalIds` |
| **Hoverable-Registry** | `collectHoverables` + Rebuild-Trigger bei jedem State-Sync |
| **RAF-Loop / Lifecycle** | `start`, `stop`, `dispose`, `animate` |

Die Extraktions-Methode ist im selben File bereits erprobt: `FocusCardFan`,
`BonusAwardFlight`, `OrbitCameraAid`, `FrustumCull`, `PerfStatsAggregator`
liegen schon in `engine-runtime/`. Konkrete nächste Schnitte:

- **`LobbyStateSyncer`** in `engine-runtime/` — kapselt `applySceneState` und
  alle State-Diff-Felder; `GameEngine` delegiert nur noch mit dem neuen
  Snapshot.
- **`BuildModeController`** in `engine-runtime/` — kapselt den Build-Spot-
  Lebenszyklus; `GameEngine` ruft `controller.enter(kind, legalIds)` /
  `controller.clear()`.
- **`HoverableRegistry`** — kapselt `collectHoverables` + die Rebuild-Logik.

**Empfehlung:** Mit `LobbyStateSyncer` beginnen — größter Block, klar
abgegrenzter I/O.

---

### 11. `countTotalResources` dreifach dupliziert

Dieselbe Ressourcen-Zähl-Logik existiert an drei Stellen:

| Ort | Funktion |
|-----|----------|
| `game/utils/public-player-resources.util.ts` | `countResourceCards(player)` |
| `game/lobby/lobby-runtime.ts` (l.239) | `countTotalResources(player)` — Instanzmethode, greift nicht auf `this` zu |
| `game/robber/robber.util.ts` (l.66) | private `countTotalResources(player)` |

**Fix:** Alle drei durch die kanonische `countResourceCards` aus
`public-player-resources.util.ts` ersetzen. Die Methode in `LobbyRuntime` und
die private Kopie in `robber.util.ts` löschen.

---

### 12. `isPlacementLegal` — Throw-as-Control-Flow im Broadcast-Hot-Path

`game-action-validation.service.ts` (l.288):

```ts
private isPlacementLegal(assertion: () => void): boolean {
  try { assertion(); return true; }
  catch { return false; }
}
```

Diese Methode wird von `computeLegalMoves` aufgerufen, das seinerseits einmal
pro verbundenen Spieler in **jedem** `broadcastFullState`-Aufruf läuft.
Exception-Objekte in V8 sind teuer (Stack-Trace-Capture); bei 4 Spielern × N
illegaler Positionen × jedem Broadcast summiert sich das.

**Fix:** Für jede `assertX`-Methode eine entsprechende `canX`-Methode
einführen, die boolean zurückgibt, ohne zu werfen. `computeLegalMoves` ruft
dann `canX` auf; `assertX` (für Handler-Validierung) bleibt unverändert und
kann intern `canX` nutzen.

---

### 13. Harbor-Geometrie wird pro Broadcast neu berechnet; `findOuterSideDirection` ist undokumentiert und ungetestet

`harbor-rate.util.ts`: `resolveHarborRates` ruft bei jedem Aufruf
`getHarborVertexSets(lobby)` auf, das seinerseits den kompletten Hex-Ring
(27 Kanten × Rotationsmatrix) neu ableitet. Da `broadcastFullState` dies einmal
pro Spieler aufruft, entstehen bei 4 Spielern 4 identische Neuberechnungen
einer rein statischen Struktur (die Karte ändert sich nach Spielstart nie).

Zusätzlich enthält `findOuterSideDirection` (l.101) eine Heuristik
(`neighborQ² + neighborR² + (neighborQ+neighborR)²`), die ohne Kommentar
erklärt, warum dieser Ausdruck die äußere Richtung maximiert. Die Funktion hat
keine Tests.

**Fix:**
1. Harbor-Vertex-Sets einmalig im `LobbyRuntime`-Konstruktor berechnen und als
   readonly-Feld cachen.
2. Kurzen Kommentar an `findOuterSideDirection` ergänzen, der erklärt, dass
   der quadrierte Abstand vom Ursprung im Axial-System das äußerste Nachbar-Hex
   identifiziert.
3. Tests für `resolveHarborRates` und `getHarborVertexSets` unter `tests/api/`
   ergänzen.

---

### 14. Presentation-State auf dem Game-Model: `lastAnnouncedLongestRoadSeat` / `lastAnnouncedLargestArmySeat`

`lobby-runtime.ts` (l.109–111):

```ts
public lastAnnouncedLongestRoadSeat: PlayerSeat | null = null;
public lastAnnouncedLargestArmySeat: PlayerSeat | null = null;
```

Diese Felder sind kein Spielzustand — sie merken sich, welcher Sitz beim
letzten Broadcast als Inhaber der Bonuskarte kommuniziert wurde, um
redundante Emits zu vermeiden. Das ist Broadcasting-/Presentation-Logik und
gehört in `LobbyService` (die sendende Schicht), nicht in `LobbyRuntime` (das
Game-Model).

**Fix:** Felder aus `LobbyRuntime` entfernen. In `LobbyService` eine private
`Map<lobbyId, { longestRoad: PlayerSeat | null; largestArmy: PlayerSeat | null }>`
führen, die beim `tearDownLobby` bereinigt wird. `announceBonusAwardTransitions`
liest und schreibt dann diese Map.

---

### 15. `emptyResourceBag()` — stateless Instanzmethode auf `LobbyRuntime`

`lobby-runtime.ts` (l.175):

```ts
public emptyResourceBag(): ResourceBag { ... }
```

Die Methode greift nicht auf `this` zu; sie ist eine reine Fabrikfunktion.
Auf `LobbyRuntime` als Instanzmethode ist sie schwer zu finden und nicht
wiederverwendbar ohne eine Instanz.

**Fix:** Als Modulfunktion oder als `emptyPublicResourceRecord`-Pendant in
`public-player-resources.util.ts` extrahieren (analog zu `emptyPublicResourceRecord`,
das dort bereits existiert).

---

### 16. `mapLobbyFullStateToSceneState` doppelt aufgerufen in `GameCanvas`

`game-canvas.ts` enthält zwei unabhängige Effects, die auf dasselbe Signal
reagieren und dabei dasselbe pure Mapping aufrufen:

```ts
// lobbyStateSync effect (l.104)
const scene = mapLobbyFullStateToSceneState(state);
engine.applySceneState(scene);

// headVideoSyncEffect (l.117)
const scene = mapLobbyFullStateToSceneState(state);  // zweiter Aufruf
this.liveKit.syncHeadVideos(scene, engine);
```

Bei jeder `FullState`-Emission wird `mapLobbyFullStateToSceneState` zweimal
mit denselben Eingaben ausgeführt.

**Fix:** Ein einzelnes `computed<LobbySceneState | null>` einführen, das das
Mapping hält. Beide Effects lesen das Computed statt `mapLobbyFullStateToSceneState`
direkt aufzurufen.

---

### 17. `GameCanvas` — zwei Codepfade für initiales Engine-Setup müssen synchron gehalten werden

Effects in `GameCanvas` haben alle ein `engine?.X()` Guard — sie feuern als
No-Op, bevor `this.engine` in `ngAfterViewInit` gesetzt wird. Da Signals ihren
Wert beim Effect-Lauf bereits emittiert haben, wird der Effect nach
`engine.start()` nicht erneut ausgelöst. `ngAfterViewInit` seedet deshalb den
Initialzustand manuell:

```ts
// ngAfterViewInit (l.234–252) — muss bei jeder neuen Engine-Einstellung gepflegt werden:
this.engine.setShadowQuality(this.gameSettings.shadowQuality());
this.engine.setSceneBrightness(this.gameSettings.sceneBrightness());
this.engine.showBuildSpots(this.buildMode(), this.freeRoadMode());
this.engine.setRobberMode(this.robberMode());
this.engine.setSpectatorCameraMode(this.spectatorCam.mode());
this.engine.setDiceRollClickEnabled(this.diceRollClickEnabled());
```

Jede neue Engine-Einstellung erfordert zwingend eine Änderung an zwei Stellen
(Effect + `ngAfterViewInit`-Block), was leicht vergessen wird.

**Fix:** Engine in `ngAfterViewInit` setzen, dann sofort `effect.trigger()` /
`markForCheck()` erzwingen — oder einen dedizierten `applyAllSettings(engine)`
Hilfsmethode einführen, die `ngAfterViewInit` aufruft und die Effects auf
dasselbe Feld delegieren. Damit gibt es einen einzigen Anwendungsort pro
Einstellung.

---

### 18. `TradeSessionService` — raw `.subscribe()` inkonsistent mit Rest des Clients

`features/trading/trade-session.service.ts` (l.62):

```ts
private tradeUpdatedSubscription: Subscription | null = null;

public constructor() {
  this.tradeUpdatedSubscription = this.sockets.tradeUpdated$.subscribe(...);
}

public ngOnDestroy(): void {
  if (this.tradeUpdatedSubscription !== null) {
    this.tradeUpdatedSubscription.unsubscribe();
    this.tradeUpdatedSubscription = null;
  }
}
```

Der Rest des Clients verwendet `takeUntilDestroyed(destroyRef)` als
kanonisches Cleanup-Muster. Manuelles `Subscription`-Management ist
fehleranfälliger und inkonsistent.

**Fix:**
```ts
private readonly destroyRef = inject(DestroyRef);

public constructor() {
  this.sockets.tradeUpdated$
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(...);
}
```

`ngOnDestroy` und das Subscription-Feld können dann entfernt werden.

---

### 20. `trade-socket.facade.ts` — irreführender Name

`game/trade/trade-socket.facade.ts` heißt "Facade", enthält aber echte
Geschäftslogik: Bot-Auto-Response auf Trade-Propose und selektive
`emitTradeUpdatedToInvolvedSockets`-Emission (kein Broadcast). Das ist kein
Pass-Through, sondern ein Service.

**Fix:** In `TradeGatewayService` oder `TradeDispatchService` umbenennen.
Dem Leser ist sofort klar, dass hier echte Logik steckt.

---

## Beobachten, nicht sofort handeln

### 10. `SessionShellFacadeService` exponiert rohe Sub-Services

`session-shell-facade.service.ts` legt zehn Sub-Services als `public readonly`
offen. Das Template kann dadurch tief durchgreifen (`ui.lobbyFlow.x()` statt
`ui.x()`). Aktuell vertretbar; sollte das Template anfangen, Methodenketten über
mehrere Service-Ebenen aufzurufen, ist eine flachere Facade-API fällig.

---

### 19. Test-Lücken bei Server-Spiellogik

Vorhanden: `scoring.spec.ts`, `game-action-validation.dev-card.spec.ts`,
`trade-recipient-slot.state-machine.spec.ts`, `resource-hand.spec.ts`,
`trade-session.service.spec.ts`.

Fehlend für deterministische, rein funktionale Logik:

| Modul | Was fehlt |
|-------|-----------|
| `harbor-rate.util.ts` | `resolveHarborRates` — komplex, keine Tests |
| `economy.service.ts` | Würfelproduktion, `bankTradeAsCurrentTurn` |
| `build-action.service.ts` | Settlement/Road/City mit Kostenabzug + Stücklimit |
| `game-action-validation.service.ts` | `computeLegalMoves` — Settlement/Road/City-Pfade |
| `match-flow.service.ts` / `turn-flow.service.ts` | Setup-Phase-Transitionen, Reihenfolge |

Diese Funktionen sind rein (deterministisch, kein I/O), was Tests unkompliziert
macht. Priorität: `resolveHarborRates` und `computeLegalMoves`-Platzierungspfade,
da Fehler dort direkt das Spielgeschehen betreffen.

---

### 21. `SessionLobbyFlowService` — zwei Concerns

`session-lobby-flow.service.ts` (425 Zeilen) enthält zwei kohärente, aber
thematisch verschiedene Concerns:

1. **Lobby-Navigations-FSM**: Sign-in → JoinLobby → Lobby → InGame,
   `runJoinLobby`, `runCreateLobby`, `leaveCurrentLobby`, `backToSignIn`.
2. **Last-Lobby-Rejoin-Probe**: `lastLobbyCode`, `lastLobbyRejoinAvailable`,
   `lastLobbyRejoinProbeGeneration`, `refreshLastLobbyRejoinAvailability`.

Die Probe-Logik hat ihren eigenen Lifecycle (Generationszähler gegen Race
Conditions, HTTP-Request via `LobbyHttpService`) und könnte in einen eigenen
`LobbyRejoinProbeService` extrahiert werden. Aktuell vertretbar; zu beobachten,
wenn die Datei weiter wächst.

---

## Was bewusst so bleibt (kein Handlungsbedarf)

- **Hardcodierte deutsche Labels im Canvas** (`PLAYER_NAME_DE`,
  `RESOURCE_LABEL_DE`, `DEV_LABEL_DE`): bewusste i18n-Aufteilung — die 3D-Engine
  rendert außerhalb von Angular und kann ngx-translate nicht nutzen
  (`CLAUDE.md`, "i18n split"). Kein Quality-Defizit.
- **Klassische `for`-Schleifen** statt `for…of`: workspace-weit per ESLint so
  gewollt, besonders in den Hot-Paths der Engine.
- **Bracket-Zugriff auf Index-Signaturen** (`process.env[Key]`, `obj['kind']`):
  von der strikten TS-Konfiguration erzwungen, absichtlich.
- **`trade-panel.ts`** (~460 Zeilen): kohärentes UI-Component — Composer-State,
  Mode-Ableitung, Affordance-Flags und Label-Formatierung sind alle Teil einer
  einzigen Interaktions-Domäne. Kein Extraktionsbedarf.
- **`console.error` in `main.ts`**: Bootstrap-Fehlerbehandlung vor Angular-Init —
  kein Logger verfügbar, kein Handlungsbedarf.
