import { ActionRejectCode, TradeRecipientStatus } from '@catan/api-interfaces';
import { TradeRecipientSlotMachine } from '@catan/api-app/app/game/trade/trade-recipient-slot.state-machine';

describe('TradeRecipientSlotMachine', () => {
  describe('accept', () => {
    it('transitions Pending → Accepted', () => {
      expect(TradeRecipientSlotMachine.accept(TradeRecipientStatus.Pending)).toBe(
        TradeRecipientStatus.Accepted,
      );
    });

    it('rejects from Countered', () => {
      expect(() => TradeRecipientSlotMachine.accept(TradeRecipientStatus.Countered)).toThrow(
        ActionRejectCode.InvalidTradeTransition,
      );
    });

    it('rejects from terminal states', () => {
      expect(() => TradeRecipientSlotMachine.accept(TradeRecipientStatus.Accepted)).toThrow(
        ActionRejectCode.InvalidTradeTransition,
      );
      expect(() => TradeRecipientSlotMachine.reject(TradeRecipientStatus.Rejected)).toThrow(
        ActionRejectCode.InvalidTradeTransition,
      );
    });
  });

  describe('counter', () => {
    it('transitions Pending → Countered', () => {
      expect(TradeRecipientSlotMachine.counter(TradeRecipientStatus.Pending)).toBe(
        TradeRecipientStatus.Countered,
      );
    });

    it('allows Countered → Countered overwrite', () => {
      expect(TradeRecipientSlotMachine.counter(TradeRecipientStatus.Countered)).toBe(
        TradeRecipientStatus.Countered,
      );
    });

    it('rejects from Accepted', () => {
      expect(() => TradeRecipientSlotMachine.counter(TradeRecipientStatus.Accepted)).toThrow(
        ActionRejectCode.InvalidTradeTransition,
      );
    });
  });

  describe('withdrawCounter', () => {
    it('transitions Countered → Pending', () => {
      expect(TradeRecipientSlotMachine.withdrawCounter(TradeRecipientStatus.Countered)).toBe(
        TradeRecipientStatus.Pending,
      );
    });

    it('rejects from Pending', () => {
      expect(() =>
        TradeRecipientSlotMachine.withdrawCounter(TradeRecipientStatus.Pending),
      ).toThrow(ActionRejectCode.InvalidTradeTransition);
    });
  });

  describe('reject', () => {
    it('transitions Pending → Rejected', () => {
      expect(TradeRecipientSlotMachine.reject(TradeRecipientStatus.Pending)).toBe(
        TradeRecipientStatus.Rejected,
      );
    });

    it('transitions Countered → Rejected', () => {
      expect(TradeRecipientSlotMachine.reject(TradeRecipientStatus.Countered)).toBe(
        TradeRecipientStatus.Rejected,
      );
    });

    it('rejects from Accepted', () => {
      expect(() => TradeRecipientSlotMachine.reject(TradeRecipientStatus.Accepted)).toThrow(
        ActionRejectCode.InvalidTradeTransition,
      );
    });
  });
});
