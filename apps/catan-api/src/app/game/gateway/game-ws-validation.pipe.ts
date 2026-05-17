import { ValidationPipe } from '@nestjs/common';
import { ActionRejectCode } from '@catan/api-interfaces';

export const GAME_WS_VALIDATION_PIPE = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
  exceptionFactory: () => new Error(ActionRejectCode.InvalidPayload),
});
