import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  PlayerSessionBundleResponse,
  SwaggerApiTag,
} from '@catan/api-interfaces';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { Public } from '../http/decorators/public.decorator';
import { SessionBootstrapDto } from './dto/session-bootstrap.dto';
import { SessionRefreshDto } from './dto/session-refresh.dto';
import { PlayerSessionJwtService } from './player-session-jwt.service';
import { isUuid } from '../game/utils/uuid.util';

@Controller('session')
@ApiTags(SwaggerApiTag.Session)
export class SessionController {
  public constructor(private readonly playerJwt: PlayerSessionJwtService) {}

  @Post('bootstrap')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Create or resume a player session (JWT pair)' })
  @ApiBody({ type: SessionBootstrapDto })
  @ApiOkResponse({ description: 'Access and refresh tokens bound to session id' })
  public async bootstrap(
    @Body() body: SessionBootstrapDto,
  ): Promise<PlayerSessionBundleResponse> {
    let sessionId: string = randomUUID();
    if (body.legacySessionId !== undefined && isUuid(body.legacySessionId)) {
      sessionId = body.legacySessionId;
    }
    const pair = await this.playerJwt.mintPair(sessionId);
    return {
      sessionId,
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      accessExpiresInSec: pair.accessExpiresInSec,
    };
  }

  @Post('refresh')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate access token using refresh token' })
  @ApiBody({ type: SessionRefreshDto })
  @ApiOkResponse({ description: 'New token pair for the same session id' })
  public async refresh(
    @Body() body: SessionRefreshDto,
  ): Promise<PlayerSessionBundleResponse> {
    const sessionId = this.playerJwt.verifyRefreshToken(body.refreshToken);
    const pair = await this.playerJwt.mintPair(sessionId);
    return {
      sessionId,
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      accessExpiresInSec: pair.accessExpiresInSec,
    };
  }
}
