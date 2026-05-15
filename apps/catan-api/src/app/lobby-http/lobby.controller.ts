import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  CreateLobbyResponseDto,
  HttpApiRelativePath,
  SwaggerApiTag,
  normalizeLobbyCode,
} from '@catan/api-interfaces';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BearerSessionGuard } from '../http/guards/bearer-session.guard';
import { RedisLobbyStoreService } from '../infrastructure/redis/redis-lobby-store.service';

interface CreateLobbyRequestDto {
  readonly lobbyCode?: string;
}

@ApiTags(SwaggerApiTag.System)
@Controller()
export class LobbyController {
  public constructor(private readonly redisLobby: RedisLobbyStoreService) {}

  @Post(HttpApiRelativePath.LobbyCreate)
  @HttpCode(200)
  @UseGuards(BearerSessionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Optional: pre-register a lobby code (join also auto-creates)' })
  @ApiOkResponse({ description: 'Lobby code and canonical id' })
  public async createLobby(@Body() body: CreateLobbyRequestDto): Promise<CreateLobbyResponseDto> {
    const lobbyCode = normalizeLobbyCode(body.lobbyCode ?? randomUUID().slice(0, 8));
    const lobbyId = await this.redisLobby.resolveOrCreateCanonicalLobbyId(lobbyCode);
    return { lobbyId, lobbyCode };
  }
}
