import { BadRequestException, Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ActionRejectCode,
  CreateLobbyResponseDto,
  HttpApiRelativePath,
  isLobbyCodeValid,
  LobbyRejoinAvailableResponseDto,
  SwaggerApiTag,
  normalizeLobbyCode,
} from '@catan/api-interfaces';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BearerSessionGuard } from '../http/guards/bearer-session.guard';
import { SessionToken } from '../http/decorators/session-token.decorator';
import { RedisLobbyStoreService } from '../infrastructure/redis/redis-lobby-store.service';

interface CreateLobbyRequestDto {
  readonly lobbyCode?: string;
}

interface LobbyRejoinAvailableRequestDto {
  readonly lobbyCode: string;
}

@ApiTags(SwaggerApiTag.System)
@Controller()
export class LobbyController {
  public constructor(private readonly redisLobby: RedisLobbyStoreService) {}

  @Post(HttpApiRelativePath.LobbyCreate)
  @HttpCode(200)
  @UseGuards(BearerSessionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Optional: pre-register a lobby code' })
  @ApiOkResponse({ description: 'Lobby code and canonical id' })
  public async createLobby(@Body() body: CreateLobbyRequestDto): Promise<CreateLobbyResponseDto> {
    const lobbyCode = normalizeLobbyCode(body.lobbyCode ?? randomUUID().slice(0, 8));
    const createdLobbyId = await this.redisLobby.createCanonicalLobbyId(lobbyCode);
    const lobbyId =
      createdLobbyId ?? (await this.redisLobby.resolveCanonicalLobbyIdByCode(lobbyCode));
    if (lobbyId === null) {
      throw new BadRequestException(ActionRejectCode.UnknownLobby);
    }
    return { lobbyId, lobbyCode };
  }

  @Post(HttpApiRelativePath.LobbyRejoinAvailable)
  @HttpCode(200)
  @UseGuards(BearerSessionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Whether the session may rejoin a remembered lobby code' })
  @ApiOkResponse({ description: 'Rejoin availability for the bearer session' })
  public async rejoinAvailable(
    @Body() body: LobbyRejoinAvailableRequestDto,
    @SessionToken() sessionToken: string,
  ): Promise<LobbyRejoinAvailableResponseDto> {
    const lobbyCode = body.lobbyCode?.trim() ?? '';
    if (!isLobbyCodeValid(lobbyCode)) {
      return { available: false };
    }
    const normalizedCode = normalizeLobbyCode(lobbyCode);
    const canonicalLobbyId = await this.redisLobby.resolveCanonicalLobbyIdByCode(lobbyCode);
    if (canonicalLobbyId === null) {
      return { available: false };
    }
    const isMember = await this.redisLobby.isMember(canonicalLobbyId, sessionToken);
    if (!isMember) {
      return { available: false };
    }
    return { available: true, lobbyCode: normalizedCode };
  }
}
