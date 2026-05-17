import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PlayerSessionJwtService } from './player-session-jwt.service';
import { SessionBootstrapRateLimitService } from './session-bootstrap-rate-limit.service';
import { SessionController } from './session.controller';
import { resolvePlayerSessionJwtSecret } from './session-jwt-secret.util';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({ secret: resolvePlayerSessionJwtSecret() }),
    }),
  ],
  controllers: [SessionController],
  providers: [PlayerSessionJwtService, SessionBootstrapRateLimitService],
  exports: [PlayerSessionJwtService],
})
export class SessionModule {}
