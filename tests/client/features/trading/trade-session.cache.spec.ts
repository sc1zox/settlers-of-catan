import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { TradeUpdateKind, type TradeUpdatedPayload } from '@catan/api-interfaces';
import { GameStateResource } from '@catan/client/app/core/game/game-state.resource';
import { GameSocketService } from '@catan/client/app/core/socket/game-socket.service';
import { TradeSessionService } from '@catan/client/app/features/trading/trade-session.service';
import { makeTradeOffer, makeTradeUpdated } from '@catan/tests/fixtures/trade.fixture';

const OPEN_KINDS: readonly TradeUpdateKind[] = [
  TradeUpdateKind.Created,
  TradeUpdateKind.RecipientAccepted,
  TradeUpdateKind.RecipientCountered,
  TradeUpdateKind.RecipientCounterWithdrawn,
  TradeUpdateKind.RecipientRejected,
  TradeUpdateKind.Resync,
];

const CLOSED_KINDS: readonly TradeUpdateKind[] = [
  TradeUpdateKind.Finalized,
  TradeUpdateKind.Cancelled,
  TradeUpdateKind.Superseded,
  TradeUpdateKind.PhaseClosed,
];

describe('TradeSessionService trade cache kinds', () => {
  let tradeUpdated$: Subject<TradeUpdatedPayload>;

  beforeEach(() => {
    tradeUpdated$ = new Subject<TradeUpdatedPayload>();
    TestBed.configureTestingModule({
      providers: [
        TradeSessionService,
        {
          provide: GameSocketService,
          useValue: { tradeUpdated$ },
        },
        {
          provide: GameStateResource,
          useValue: {
            canonicalLobbyId: signal('lobby-canonical'),
            connection: signal(undefined),
            lobby: { value: () => undefined },
          },
        },
      ],
    });
  });

  for (let i = 0; i < OPEN_KINDS.length; i += 1) {
    const kind = OPEN_KINDS[i];
    it(`keeps pending trade on ${kind}`, () => {
      const service = TestBed.inject(TradeSessionService);
      tradeUpdated$.next(makeTradeUpdated(kind, makeTradeOffer()));
      expect(service.pendingTrade()).not.toBeNull();
    });
  }

  for (let i = 0; i < CLOSED_KINDS.length; i += 1) {
    const kind = CLOSED_KINDS[i];
    it(`clears pending trade on ${kind}`, () => {
      const service = TestBed.inject(TradeSessionService);
      tradeUpdated$.next(makeTradeUpdated(TradeUpdateKind.Created, makeTradeOffer()));
      tradeUpdated$.next(makeTradeUpdated(kind, makeTradeOffer()));
      expect(service.pendingTrade()).toBeNull();
    });
  }
});
