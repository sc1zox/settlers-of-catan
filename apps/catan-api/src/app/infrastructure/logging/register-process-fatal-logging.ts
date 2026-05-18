import { Logger } from '@nestjs/common';

const processLogger = new Logger('Process');

export function registerProcessFatalLogging(): void {
  process.on('uncaughtException', (error: Error) => {
    processLogger.error('uncaughtException', error.stack ?? error.message);
  });
  process.on('unhandledRejection', (reason: unknown) => {
    if (reason instanceof Error) {
      processLogger.error('unhandledRejection', reason.stack ?? reason.message);
      return;
    }
    processLogger.error(`unhandledRejection: ${String(reason)}`);
  });
}
