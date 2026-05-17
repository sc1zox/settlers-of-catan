import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuthErrorCode, PlayerSessionBundleResponse, SwaggerApiTag } from '@catan/api-interfaces';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../http/decorators/public.decorator';
import { SessionBootstrapDto } from './dto/session-bootstrap.dto';
import { SessionRefreshDto } from './dto/session-refresh.dto';
import { PlayerSessionJwtService } from './player-session-jwt.service';
import { SessionBootstrapRateLimitService } from './session-bootstrap-rate-limit.service';
import {
  clearRefreshTokenCookie,
  readRefreshTokenFromCookieHeader,
  setRefreshTokenCookie,
} from './session-cookie.util';

@Controller('session')
@ApiTags(SwaggerApiTag.Session)
export class SessionController {
  public constructor(
    private readonly playerJwt: PlayerSessionJwtService,
    private readonly bootstrapRateLimit: SessionBootstrapRateLimitService,
  ) {}

  @Post('bootstrap')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Create a new anonymous player session (JWT + HttpOnly refresh cookie)' })
  @ApiBody({ type: SessionBootstrapDto })
  @ApiOkResponse({ description: 'Access token and session id; refresh token is HttpOnly cookie only' })
  public async bootstrap(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PlayerSessionBundleResponse> {
    this.bootstrapRateLimit.assertAllowed(req);
    const sessionId = randomUUID();
    const pair = await this.playerJwt.mintPair(sessionId);
    setRefreshTokenCookie(res, pair.refreshToken, pair.refreshTtlSec);
    return {
      sessionId,
      accessToken: pair.accessToken,
      accessExpiresInSec: pair.accessExpiresInSec,
    };
  }

  @Post('refresh')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate access token using HttpOnly refresh cookie' })
  @ApiBody({ type: SessionRefreshDto })
  @ApiOkResponse({ description: 'New access token; refresh cookie rotated' })
  public async refresh(
    @Body() body: SessionRefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PlayerSessionBundleResponse> {
    const refreshToken =
      readRefreshTokenFromCookieHeader(req.headers.cookie) ?? body.refreshToken?.trim();
    if (refreshToken === undefined || refreshToken.length === 0) {
      throw new UnauthorizedException(AuthErrorCode.InvalidRefreshToken);
    }
    const sessionId = this.playerJwt.verifyRefreshToken(refreshToken);
    const pair = await this.playerJwt.mintPair(sessionId);
    setRefreshTokenCookie(res, pair.refreshToken, pair.refreshTtlSec);
    return {
      sessionId,
      accessToken: pair.accessToken,
      accessExpiresInSec: pair.accessExpiresInSec,
    };
  }

  @Post('logout')
  @Public()
  @HttpCode(204)
  @ApiOperation({ summary: 'Clear the HttpOnly refresh session cookie' })
  public logout(@Res({ passthrough: true }) res: Response): void {
    clearRefreshTokenCookie(res);
  }
}
