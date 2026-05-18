import { ArgumentsHost, Catch, ExceptionFilter, Injectable, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { ActionRejectCode, isExpectedActionRejectError } from '@catan/api-interfaces';
import { Socket } from 'socket.io';
import { logUnexpectedError } from '../../infrastructure/logging/log-unexpected-error.util';
import { GatewayActionRejectService } from './gateway-common.services';

@Injectable()
@Catch()
export class GameGatewayExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GameGatewayExceptionFilter.name);

  public constructor(private readonly reject: GatewayActionRejectService) {}

  public catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'ws') {
      throw exception;
    }
    const client = host.switchToWs().getClient<Socket>();
    const error = GameGatewayExceptionFilter.toRejectError(exception);
    if (!isExpectedActionRejectError(exception)) {
      logUnexpectedError(
        this.logger,
        `socket ${client.id} unexpected action error`,
        exception,
      );
    }
    this.reject.emit(client, error);
  }

  private static toRejectError(exception: unknown): Error {
    if (exception instanceof Error) {
      return exception;
    }
    if (exception instanceof WsException) {
      const payload = exception.getError();
      if (typeof payload === 'string') {
        return new Error(payload);
      }
      if (payload instanceof Error) {
        return payload;
      }
    }
    return new Error(ActionRejectCode.Unknown);
  }
}
