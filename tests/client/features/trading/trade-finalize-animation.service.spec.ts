import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  PlayerSeat,
  ResourceType,
  TradeRecipientStatus,
  TradeStatus,
  TradeUpdateKind,
  type TradeOfferDto,
  type TradeUpdatedPayload,
} from '@catan/api-interfaces';
import { TradeFinalizeAnimationService } from '@catan/client/app/features/trading/trade-finalize-animation.service';
import { TradeSessionService } from '@catan/client/app/features/trading/trade-session.service';

describe('TradeFinalizeAnimationService', () => {
  const lastTradeUpdateSignal = signal<TradeUpdatedPayload | undefined>(undefined);

  beforeEach(() => {
    lastTradeUpdateSignal.set(undefined);
    TestBed.configureTestingModule({
      providers: [
        TradeFinalizeAnimationService,
        {
          provide: TradeSessionService,
          useValue: {
            lastTradeUpdate: lastTradeUpdateSignal.asReadonly(),
            resetSession: vi.fn(),
          },
        },
      ],
    });
  });

  it('sets swapRequest on Finalized with counter maps', () => {
    const service = TestBed.inject(TradeFinalizeAnimationService);
    const trade: TradeOfferDto = {
      id: 't1',
      lobbyId: 'lobby-1',
      fromSeat: PlayerSeat.North,
      offer: { [ResourceType.Wood]: 2 },
      request: { [ResourceType.Wheat]: 1 },
      recipients: [
        {
          seat: PlayerSeat.East,
          status: TradeRecipientStatus.Countered,
          counter: {
            offer: { [ResourceType.Brick]: 1 },
            request: { [ResourceType.Ore]: 3 },
          },
        },
      ],
      status: TradeStatus.Open,
      finalizedWithSeat: PlayerSeat.East,
    };
    lastTradeUpdateSignal.set({
      lobbyId: 'lobby-1',
      trade,
      kind: TradeUpdateKind.Finalized,
      actorSeat: PlayerSeat.North,
    });
    TestBed.flushEffects();
    expect(service.swapRequest()).toEqual({
      tradeId: 't1',
      fromSeat: PlayerSeat.North,
      recipientSeat: PlayerSeat.East,
      give: { [ResourceType.Brick]: 1 },
      take: { [ResourceType.Ore]: 3 },
    });
  });

  it('does not replay the same trade id', () => {
    const service = TestBed.inject(TradeFinalizeAnimationService);
    const trade: TradeOfferDto = {
      id: 't1',
      lobbyId: 'lobby-1',
      fromSeat: PlayerSeat.North,
      offer: {},
      request: {},
      recipients: [{ seat: PlayerSeat.East, status: TradeRecipientStatus.Accepted }],
      status: TradeStatus.Open,
      finalizedWithSeat: PlayerSeat.East,
    };
    const update: TradeUpdatedPayload = {
      lobbyId: 'lobby-1',
      trade,
      kind: TradeUpdateKind.Finalized,
      actorSeat: PlayerSeat.North,
    };
    lastTradeUpdateSignal.set(update);
    TestBed.flushEffects();
    service.consumePendingSwap();
    lastTradeUpdateSignal.set(update);
    TestBed.flushEffects();
    expect(service.swapRequest()).toBeNull();
  });

  it('consumePendingSwap clears swapRequest', () => {
    const service = TestBed.inject(TradeFinalizeAnimationService);
    const trade: TradeOfferDto = {
      id: 't2',
      lobbyId: 'lobby-1',
      fromSeat: PlayerSeat.South,
      offer: { [ResourceType.Wool]: 1 },
      request: {},
      recipients: [{ seat: PlayerSeat.West, status: TradeRecipientStatus.Accepted }],
      status: TradeStatus.Open,
      finalizedWithSeat: PlayerSeat.West,
    };
    lastTradeUpdateSignal.set({
      lobbyId: 'lobby-1',
      trade,
      kind: TradeUpdateKind.Finalized,
      actorSeat: PlayerSeat.South,
    });
    TestBed.flushEffects();
    expect(service.swapRequest()).not.toBeNull();
    service.consumePendingSwap();
    expect(service.swapRequest()).toBeNull();
  });

  it('resetSession clears animation state', () => {
    const service = TestBed.inject(TradeFinalizeAnimationService);
    service.resetSession();
    expect(service.swapRequest()).toBeNull();
  });
});
