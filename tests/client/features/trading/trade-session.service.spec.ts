import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import {
  PlayerSeat,
  ResourceType,
  TradeUpdateKind,
  type LobbyFullStatePayload,
  type TradeUpdatedPayload,
} from '@catan/api-interfaces';
import { GameStateResource } from '@catan/client/app/core/game/game-state.resource';
import { GameSocketService } from '@catan/client/app/core/socket/game-socket.service';
import { TradeSessionService } from '@catan/client/app/features/trading/trade-session.service';
import { makeTradeOffer, makeTradeUpdated } from '@catan/tests/fixtures/trade.fixture';

describe('TradeSessionService', () => {
  let tradeUpdated$: Subject<TradeUpdatedPayload>;
  let canonicalLobbyId: ReturnType<typeof signal<string>>;
  let connection: ReturnType<
    typeof signal<{ lobbyId: string; lobbyCode: string; displayName: string } | undefined>
  >;
  let lobbyValue: ReturnType<typeof signal<LobbyFullStatePayload | undefined>>;
  let proposeTradeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    tradeUpdated$ = new Subject<TradeUpdatedPayload>();
    canonicalLobbyId = signal('lobby-canonical');
    connection = signal({
      lobbyId: 'lobby-canonical',
      lobbyCode: 'ABCD',
      displayName: 'Alice',
    });
    lobbyValue = signal(undefined);
    proposeTradeSpy = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        TradeSessionService,
        {
          provide: GameSocketService,
          useValue: {
            tradeUpdated$,
            proposeTrade: proposeTradeSpy,
            finishTrading: vi.fn(),
            acceptTrade: vi.fn(),
            rejectTrade: vi.fn(),
            counterTrade: vi.fn(),
            withdrawCounterTrade: vi.fn(),
            finalizeTrade: vi.fn(),
            bankTrade: vi.fn(),
          },
        },
        {
          provide: GameStateResource,
          useValue: {
            canonicalLobbyId,
            connection,
            lobby: { value: () => lobbyValue() },
          },
        },
      ],
    });
  });

  it('caches trade on open update kinds', () => {
    const service = TestBed.inject(TradeSessionService);
    const trade = makeTradeOffer();
    tradeUpdated$.next(makeTradeUpdated(TradeUpdateKind.Created, trade));
    expect(service.pendingTrade()).toEqual(trade);
    expect(service.selfHasOpenTrade()).toBe(true);
  });

  it('clears cache on Finalized', () => {
    const service = TestBed.inject(TradeSessionService);
    const trade = makeTradeOffer();
    tradeUpdated$.next(makeTradeUpdated(TradeUpdateKind.Created, trade));
    tradeUpdated$.next(makeTradeUpdated(TradeUpdateKind.Finalized, trade));
    expect(service.pendingTrade()).toBeNull();
    expect(service.selfHasOpenTrade()).toBe(false);
  });

  it('ignores updates for a different lobby', () => {
    const service = TestBed.inject(TradeSessionService);
    tradeUpdated$.next({
      ...makeTradeUpdated(TradeUpdateKind.Created, makeTradeOffer()),
      lobbyId: 'other-lobby',
    });
    expect(service.pendingTrade()).toBeNull();
  });

  it('ignores updates when canonical lobby id is empty', () => {
    canonicalLobbyId.set('');
    const service = TestBed.inject(TradeSessionService);
    tradeUpdated$.next(makeTradeUpdated(TradeUpdateKind.Created, makeTradeOffer()));
    expect(service.pendingTrade()).toBeNull();
  });

  it('resetSession clears cache and last update', () => {
    const service = TestBed.inject(TradeSessionService);
    tradeUpdated$.next(makeTradeUpdated(TradeUpdateKind.Created, makeTradeOffer()));
    service.resetSession();
    expect(service.pendingTrade()).toBeNull();
    expect(service.lastTradeUpdate()).toBeUndefined();
  });

  it('proposeTrade emits when connected', () => {
    const service = TestBed.inject(TradeSessionService);
    const offer = { [ResourceType.Wood]: 1 };
    const request = { [ResourceType.Wheat]: 1 };
    service.proposeTrade([PlayerSeat.East], offer, request);
    expect(proposeTradeSpy).toHaveBeenCalledWith(
      'lobby-canonical',
      [PlayerSeat.East],
      offer,
      request,
    );
  });

  it('proposeTrade is a no-op without connection', () => {
    connection.set(undefined);
    const service = TestBed.inject(TradeSessionService);
    service.proposeTrade([PlayerSeat.East], {}, {});
    expect(proposeTradeSpy).not.toHaveBeenCalled();
  });

  it('tradePartners lists non-self players from lobby state', () => {
    const minimalPlayer = {
      isBot: false,
      isConnected: true,
      resources: {},
      totalResourceCards: 0,
      devCardsInHand: 0,
      devCardsBoughtThisTurn: 0,
      hasPlayedDevCardThisTurn: false,
      playedKnights: 0,
      visibleVictoryPoints: 0,
      totalVictoryPoints: 0,
      longestRoadLength: 0,
      harborRates: { generic: 4, perResource: {} },
      remainingPieces: { settlements: 5, cities: 4, roads: 15 },
      disconnectGraceExpiresAt: null,
      awaitingAdminDecision: false,
    };
    lobbyValue.set({
      lobbyId: 'lobby-canonical',
      lobbyCode: 'ABCD',
      players: [
        { ...minimalPlayer, seat: PlayerSeat.North, displayName: 'Alice', isSelf: true },
        { ...minimalPlayer, seat: PlayerSeat.East, displayName: 'Bob', isSelf: false },
      ],
    } as unknown as LobbyFullStatePayload);
    const service = TestBed.inject(TradeSessionService);
    expect(service.tradePartners()).toEqual([{ seat: PlayerSeat.East, name: 'Bob' }]);
  });
});
