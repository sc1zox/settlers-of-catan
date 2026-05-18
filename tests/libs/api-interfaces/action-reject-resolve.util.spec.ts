import {
  ActionRejectCode,
  asActionRejectCode,
  isExpectedActionRejectError,
} from '@catan/api-interfaces';

describe('asActionRejectCode', () => {
  it('maps known reject message strings to enum values', () => {
    expect(asActionRejectCode(ActionRejectCode.WrongPhase)).toBe(ActionRejectCode.WrongPhase);
    expect(asActionRejectCode(ActionRejectCode.InvalidTradeTransition)).toBe(
      ActionRejectCode.InvalidTradeTransition,
    );
  });

  it('returns Unknown for unrecognized messages', () => {
    expect(asActionRejectCode('not_a_real_code')).toBe(ActionRejectCode.Unknown);
  });
});

describe('isExpectedActionRejectError', () => {
  it('returns true for Error with a known reject code message', () => {
    expect(isExpectedActionRejectError(new Error(ActionRejectCode.NotYourTurn))).toBe(true);
  });

  it('returns false for Error with unknown message', () => {
    expect(isExpectedActionRejectError(new Error('boom'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isExpectedActionRejectError('wrong_phase')).toBe(false);
    expect(isExpectedActionRejectError(null)).toBe(false);
  });
});
