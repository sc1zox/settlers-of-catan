import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ProcessEnvKey } from '@catan/api-interfaces';
import { PlayerSessionJwtService } from './player-session-jwt.service';
import { SessionController } from './session.controller';

@Global()
@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret:
        process.env[ProcessEnvKey.PlayerSessionJwtSecret] ??
        'catan-dev-only-jwt-secret-minimum-32-characters-long',
    }),
  ],
  controllers: [SessionController],
  providers: [PlayerSessionJwtService],
  exports: [PlayerSessionJwtService],
})
export class SessionModule {}
