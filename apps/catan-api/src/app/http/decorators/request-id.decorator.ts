import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import type { Request } from 'express';

export const RequestId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const id = ctx.switchToHttp().getRequest<Request>().requestId;
  if (id === undefined || id.length === 0) {
    throw new InternalServerErrorException('request_id_missing');
  }
  return id;
});
