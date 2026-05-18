import { Logger } from '@nestjs/common';

export function logUnexpectedError(logger: Logger, context: string, error: unknown): void {
  if (error instanceof Error) {
    logger.error(context, error.stack ?? error.message);
    return;
  }
  logger.error(`${context}: ${String(error)}`);
}
