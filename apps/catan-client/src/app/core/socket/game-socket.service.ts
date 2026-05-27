import { Injectable, OnDestroy, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import {
  ActionRejectedPayload,
  BankTradePayload,
  BonusAwardedPayload,
  BuildCityPayload,
  BuildRoadPayload,
  BuildSettlementPayload,
  BuyDevCardPayload,
  ClientConnectErrorCode,
  CreateLobbyPayload,
  FillLobbyWithBotsPayload,
  PlayKnightPayload,
  PlayMonopolyPayload,
  PlayRoadBuildingPayload,
  PlayYearOfPlentyPayload,
  DiceRolledPayload,
  EndTurnPayload,
  FinishTradingPayload,
  GameSocketClientEvent,
  GameSocketServerEvent,
  JoinLobbyPayload,
  KickAndReplaceWithBotPayload,
  LeaveLobbyPayload,
  LobbyFullStatePayload,
  LobbyJoinedPayload,
  LobbyTerminatedPayload,
  MoveRobberPayload,
  PlayerSeat,
  ResourceType,
  RobberDiscardPayload,
  RollDicePayload,
  SocketAuthPayloadKey,
  SocketIoTransportName,
  SocketIoUrlPathSegment,
  StartLobbyPayload,
  TradeAcceptPayload,
  TradeCounterPayload,
  TradeFinalizePayload,
  TradeProposePayload,
  TradeRejectPayload,
  TradeUpdatedPayload,
  TradeWithdrawCounterPayload,
} from '@catan/api-interfaces';
import { environment } from '../../../environments/environment';
import { PlayerSessionService } from '../session/player-session.service';

@Injectable({ providedIn: 'root' })
export class GameSocketService implements OnDestroy {
  private readonly session = inject(PlayerSessionService);

  private readonly fullStateSubject = new Subject<LobbyFullStatePayload>();
  private readonly diceRolledSubject = new Subject<DiceRolledPayload>();
  private readonly tradeUpdatedSubject = new Subject<TradeUpdatedPayload>();
  private readonly actionRejectedSubject = new Subject<ActionRejectedPayload>();
  private readonly bonusAwardedSubject = new Subject<BonusAwardedPayload>();
  private readonly lobbyJoinedSubject = new Subject<LobbyJoinedPayload>();
  private readonly lobbyTerminatedSubject = new Subject<LobbyTerminatedPayload>();

  public readonly fullState$ = this.fullStateSubject.asObservable();
  public readonly lobbyJoined$ = this.lobbyJoinedSubject.asObservable();
  public readonly diceRolled$ = this.diceRolledSubject.asObservable();
  public readonly tradeUpdated$ = this.tradeUpdatedSubject.asObservable();
  public readonly actionRejected$ = this.actionRejectedSubject.asObservable();
  public readonly bonusAwarded$ = this.bonusAwardedSubject.asObservable();
  public readonly lobbyTerminated$ = this.lobbyTerminatedSubject.asObservable();

  private socket: Socket | null = null;
  private connectErrorRetries = 0;

  public async connect(): Promise<void> {
    if (this.socket?.connected) {
      return;
    }
    await this.session.ensureReady();
    const access = this.session.accessToken();
    if (access.length === 0) {
      throw new Error(ClientConnectErrorCode.PlayerSessionNotReady);
    }
    if (this.socket !== null) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    const url = `${environment.apiBaseUrl}/${SocketIoUrlPathSegment.GameNamespace}`;
    const created = io(url, {
      transports: [SocketIoTransportName.WebSocket],
      autoConnect: true,
      auth: { [SocketAuthPayloadKey.AccessToken]: access },
    });
    this.socket = created;
    this.connectErrorRetries = 0;
    try {
      await this.waitForInitialSocketConnection(created);
    } catch (e) {
      created.removeAllListeners();
      created.disconnect();
      this.socket = null;
      throw e;
    }
    this.attachGamePayloadHandlers(created);
    created.on('connect_error', () => {
      void this.onConnectError();
    });
  }

  public ngOnDestroy(): void {
    this.disconnect();
  }

  public get isConnected(): boolean {
    return this.socket?.connected === true;
  }

  public disconnect(): void {
    if (this.socket === null) {
      return;
    }
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
  }

  public joinLobby(lobbyCode: string, displayName: string): void {
    const payload: JoinLobbyPayload = { lobbyCode, displayName };
    this.socket?.emit(GameSocketClientEvent.JoinLobby, payload);
  }

  public createLobby(lobbyCode: string, displayName: string): void {
    const payload: CreateLobbyPayload = { lobbyCode, displayName };
    this.socket?.emit(GameSocketClientEvent.CreateLobby, payload);
  }

  public startLobby(lobbyId: string): void {
    const payload: StartLobbyPayload = { lobbyId };
    this.socket?.emit(GameSocketClientEvent.StartLobby, payload);
  }

  public fillLobbyWithBots(lobbyId: string): void {
    const payload: FillLobbyWithBotsPayload = { lobbyId };
    this.socket?.emit(GameSocketClientEvent.FillLobbyWithBots, payload);
  }

  public leaveLobby(lobbyId: string): void {
    if (lobbyId.length === 0) {
      return;
    }
    const payload: LeaveLobbyPayload = { lobbyId };
    this.socket?.emit(GameSocketClientEvent.LeaveLobby, payload);
  }

  public kickAndReplaceWithBot(lobbyId: string, seat: PlayerSeat): void {
    if (lobbyId.length === 0) {
      return;
    }
    const payload: KickAndReplaceWithBotPayload = { lobbyId, seat };
    this.socket?.emit(GameSocketClientEvent.KickAndReplaceWithBot, payload);
  }

  public buildSettlement(lobbyId: string, vertexId: string): void {
    const payload: BuildSettlementPayload = { lobbyId, vertexId };
    this.socket?.emit(GameSocketClientEvent.BuildSettlement, payload);
  }

  public buildRoad(lobbyId: string, edgeId: string): void {
    const payload: BuildRoadPayload = { lobbyId, edgeId };
    this.socket?.emit(GameSocketClientEvent.BuildRoad, payload);
  }

  public buildCity(lobbyId: string, vertexId: string): void {
    const payload: BuildCityPayload = { lobbyId, vertexId };
    this.socket?.emit(GameSocketClientEvent.BuildCity, payload);
  }

  public buyDevCard(lobbyId: string): void {
    const payload: BuyDevCardPayload = { lobbyId };
    this.socket?.emit(GameSocketClientEvent.BuyDevCard, payload);
  }

  public rollDice(lobbyId: string): void {
    const payload: RollDicePayload = { lobbyId };
    this.socket?.emit(GameSocketClientEvent.RollDice, payload);
  }

  public submitRobberDiscard(
    lobbyId: string,
    discard: Readonly<Partial<Record<ResourceType, number>>>,
  ): void {
    const payload: RobberDiscardPayload = { lobbyId, discard };
    this.socket?.emit(GameSocketClientEvent.RobberDiscard, payload);
  }

  public moveRobber(lobbyId: string, q: number, r: number, victimSeat?: PlayerSeat): void {
    const payload: MoveRobberPayload = { lobbyId, q, r, victimSeat };
    this.socket?.emit(GameSocketClientEvent.MoveRobber, payload);
  }

  public playKnight(lobbyId: string, q: number, r: number, victimSeat?: PlayerSeat): void {
    const payload: PlayKnightPayload = { lobbyId, q, r, victimSeat };
    this.socket?.emit(GameSocketClientEvent.PlayKnight, payload);
  }

  public playMonopoly(lobbyId: string, resource: ResourceType): void {
    const payload: PlayMonopolyPayload = { lobbyId, resource };
    this.socket?.emit(GameSocketClientEvent.PlayMonopoly, payload);
  }

  public playYearOfPlenty(lobbyId: string, first: ResourceType, second: ResourceType): void {
    const payload: PlayYearOfPlentyPayload = { lobbyId, first, second };
    this.socket?.emit(GameSocketClientEvent.PlayYearOfPlenty, payload);
  }

  public playRoadBuilding(lobbyId: string, firstEdgeId: string, secondEdgeId?: string): void {
    const payload: PlayRoadBuildingPayload = { lobbyId, firstEdgeId, secondEdgeId };
    this.socket?.emit(GameSocketClientEvent.PlayRoadBuilding, payload);
  }

  public bankTrade(
    lobbyId: string,
    giveResource: ResourceType,
    giveAmount: number,
    receiveResource: ResourceType,
  ): void {
    const payload: BankTradePayload = { lobbyId, giveResource, giveAmount, receiveResource };
    this.socket?.emit(GameSocketClientEvent.BankTrade, payload);
  }

  public finishTrading(lobbyId: string): void {
    const payload: FinishTradingPayload = { lobbyId };
    this.socket?.emit(GameSocketClientEvent.FinishTrading, payload);
  }

  public endTurn(lobbyId: string): void {
    const payload: EndTurnPayload = { lobbyId };
    this.socket?.emit(GameSocketClientEvent.EndTurn, payload);
  }

  public proposeTrade(
    lobbyId: string,
    recipients: readonly PlayerSeat[],
    offer: Readonly<Partial<Record<ResourceType, number>>>,
    request: Readonly<Partial<Record<ResourceType, number>>>,
  ): void {
    const payload: TradeProposePayload = { lobbyId, recipients, offer, request };
    this.socket?.emit(GameSocketClientEvent.TradePropose, payload);
  }

  public acceptTrade(lobbyId: string, tradeId: string): void {
    const payload: TradeAcceptPayload = { lobbyId, tradeId };
    this.socket?.emit(GameSocketClientEvent.TradeAccept, payload);
  }

  public rejectTrade(lobbyId: string, tradeId: string): void {
    const payload: TradeRejectPayload = { lobbyId, tradeId };
    this.socket?.emit(GameSocketClientEvent.TradeReject, payload);
  }

  public counterTrade(
    lobbyId: string,
    tradeId: string,
    offer: Readonly<Partial<Record<ResourceType, number>>>,
    request: Readonly<Partial<Record<ResourceType, number>>>,
  ): void {
    const payload: TradeCounterPayload = { lobbyId, tradeId, offer, request };
    this.socket?.emit(GameSocketClientEvent.TradeCounter, payload);
  }

  public withdrawCounterTrade(lobbyId: string, tradeId: string): void {
    const payload: TradeWithdrawCounterPayload = { lobbyId, tradeId };
    this.socket?.emit(GameSocketClientEvent.TradeWithdrawCounter, payload);
  }

  public finalizeTrade(lobbyId: string, tradeId: string, recipientSeat: PlayerSeat): void {
    const payload: TradeFinalizePayload = { lobbyId, tradeId, recipientSeat };
    this.socket?.emit(GameSocketClientEvent.TradeFinalize, payload);
  }

  private attachGamePayloadHandlers(s: Socket): void {
    s.off(GameSocketServerEvent.FullState);
    s.off(GameSocketServerEvent.DiceRolled);
    s.off(GameSocketServerEvent.TradeUpdated);
    s.off(GameSocketServerEvent.ActionRejected);
    s.off(GameSocketServerEvent.BonusAwarded);
    s.off(GameSocketServerEvent.LobbyJoined);
    s.off(GameSocketServerEvent.LobbyTerminated);
    s.on(GameSocketServerEvent.LobbyJoined, (payload: LobbyJoinedPayload) => {
      this.lobbyJoinedSubject.next(payload);
    });
    s.on(GameSocketServerEvent.LobbyTerminated, (payload: LobbyTerminatedPayload) => {
      this.lobbyTerminatedSubject.next(payload);
    });
    s.on(GameSocketServerEvent.FullState, (payload: LobbyFullStatePayload) => {
      this.fullStateSubject.next(payload);
    });
    s.on(GameSocketServerEvent.DiceRolled, (payload: DiceRolledPayload) => {
      this.diceRolledSubject.next(payload);
    });
    s.on(GameSocketServerEvent.TradeUpdated, (payload: TradeUpdatedPayload) => {
      this.tradeUpdatedSubject.next(payload);
    });
    s.on(GameSocketServerEvent.ActionRejected, (payload: ActionRejectedPayload) => {
      this.actionRejectedSubject.next(payload);
    });
    s.on(GameSocketServerEvent.BonusAwarded, (payload: BonusAwardedPayload) => {
      this.bonusAwardedSubject.next(payload);
    });
  }

  private async waitForInitialSocketConnection(s: Socket): Promise<void> {
    if (s.connected) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        s.off('connect', onConnect);
        s.off('connect_error', onErr);
        reject(new Error(ClientConnectErrorCode.SocketConnectTimeout));
      }, 15_000);
      const onConnect = (): void => {
        clearTimeout(timer);
        s.off('connect_error', onErr);
        resolve();
      };
      const onErr = (): void => {
        clearTimeout(timer);
        s.off('connect', onConnect);
        reject(new Error(ClientConnectErrorCode.SocketHandshakeRejected));
      };
      s.once('connect', onConnect);
      s.once('connect_error', onErr);
    });
  }

  private async onConnectError(): Promise<void> {
    if (this.connectErrorRetries >= 2) {
      return;
    }
    this.connectErrorRetries += 1;
    await this.session.ensureReady();
    const nextAccess = this.session.accessToken();
    if (this.socket !== null && nextAccess.length > 0) {
      this.socket.auth = {
        [SocketAuthPayloadKey.AccessToken]: nextAccess,
      };
      this.socket.connect();
    }
  }
}
