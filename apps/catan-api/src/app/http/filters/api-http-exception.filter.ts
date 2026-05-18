import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ActionRejectCode,
  asActionRejectCode,
  AuthErrorCode,
  HttpErrorCode,
  InternalApiErrorCode,
} from '@catan/api-interfaces';
import type { Request, Response } from 'express';
import { logUnexpectedError } from '../../infrastructure/logging/log-unexpected-error.util';

@Catch()
export class ApiHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiHttpExceptionFilter.name);

  public catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      throw exception;
    }
    const req = host.switchToHttp().getRequest<Request>();
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = ApiHttpExceptionFilter.resolveHttpExceptionCode(exception);
      res.status(status).json({ statusCode: status, code });
      return;
    }
    logUnexpectedError(this.logger, `${req.method} ${req.originalUrl}`, exception);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: InternalApiErrorCode.Unexpected,
    });
  }

  private static resolveHttpExceptionCode(exception: HttpException): string {
    const response = exception.getResponse();
    if (typeof response === 'string') {
      return ApiHttpExceptionFilter.sanitizeKnownCode(response);
    }
    if (response !== null && typeof response === 'object') {
      const record = response as Record<string, unknown>;
      const message = record['message'];
      if (typeof message === 'string') {
        return ApiHttpExceptionFilter.sanitizeKnownCode(message);
      }
      if (Array.isArray(message)) {
        return AuthErrorCode.InvalidRequest;
      }
    }
    return InternalApiErrorCode.Unexpected;
  }

  private static sanitizeKnownCode(raw: string): string {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return InternalApiErrorCode.Unexpected;
    }
    const authValues = Object.values(AuthErrorCode) as string[];
    for (let i = 0; i < authValues.length; i += 1) {
      if (authValues[i] === trimmed) {
        return trimmed;
      }
    }
    const httpValues = Object.values(HttpErrorCode) as string[];
    for (let i = 0; i < httpValues.length; i += 1) {
      if (httpValues[i] === trimmed) {
        return trimmed;
      }
    }
    const rejectCode = asActionRejectCode(trimmed);
    if (rejectCode !== ActionRejectCode.Unknown) {
      return rejectCode;
    }
    return InternalApiErrorCode.Unexpected;
  }
}
