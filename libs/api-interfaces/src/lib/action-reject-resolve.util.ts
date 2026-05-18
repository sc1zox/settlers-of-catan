import { ActionRejectCode } from './action-reject-code.enum';

export function asActionRejectCode(message: string): ActionRejectCode {
  const values = Object.values(ActionRejectCode) as string[];
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] === message) {
      return message as ActionRejectCode;
    }
  }
  return ActionRejectCode.Unknown;
}

export function isExpectedActionRejectError(exception: unknown): boolean {
  if (!(exception instanceof Error)) {
    return false;
  }
  return asActionRejectCode(exception.message) !== ActionRejectCode.Unknown;
}
