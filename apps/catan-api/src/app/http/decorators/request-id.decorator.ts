import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { InternalApiErrorCode } from '@catan/api-interfaces';
import type { Request } from 'express';

export const RequestId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const id = ctx.switchToHttp().getRequest<Request>().requestId;
  if (id === undefined || id.length === 0) {
    throw new InternalServerErrorException(InternalApiErrorCode.RequestIdMissing);
  }
  return id;
});
