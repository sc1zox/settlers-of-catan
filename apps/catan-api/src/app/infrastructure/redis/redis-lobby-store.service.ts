import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  LobbyMemberRedisRecord,
  ProcessEnvKey,
  RedisKeyPrefix,
  RedisKeySegment,
  normalizeLobbyCode,
} from '@catan/api-interfaces';
import Redis from 'ioredis';

const DEFAULT_LOBBY_IDLE_TTL_SECONDS = 300;
const MIN_LOBBY_IDLE_TTL_SECONDS = 60;
const MAX_LOBBY_IDLE_TTL_SECONDS = 86_400;

@Injectable()
export class RedisLobbyStoreService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisLobbyStoreService.name);
  private readonly client: Redis;
  private readonly idleLobbyTtlSeconds: number;

  public constructor() {
    const parsed = Number(process.env[ProcessEnvKey.LobbyIdleTtlSeconds]);
    this.idleLobbyTtlSeconds =
      Number.isFinite(parsed) &&
      parsed >= MIN_LOBBY_IDLE_TTL_SECONDS &&
      parsed <= MAX_LOBBY_IDLE_TTL_SECONDS
        ? Math.floor(parsed)
        : DEFAULT_LOBBY_IDLE_TTL_SECONDS;
    const url = process.env[ProcessEnvKey.RedisUrl] ?? 'redis://127.0.0.1:6379';
    this.client = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
    this.client.connect().catch((error: unknown) => {
      if (error instanceof Error) {
        this.logger.warn(`Redis connect failed: ${error.message}`);
        return;
      }
      this.logger.warn('Redis connect failed');
    });
  }

  public async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  public async resolveCanonicalLobbyIdByCode(lobbyCode: string): Promise<string | null> {
    const normalizedCode = normalizeLobbyCode(lobbyCode);
    const aliasKey = this.aliasKey(normalizedCode);
    return this.client.get(aliasKey);
  }

  public async createCanonicalLobbyId(lobbyCode: string): Promise<string | null> {
    const normalizedCode = normalizeLobbyCode(lobbyCode);
    const aliasKey = this.aliasKey(normalizedCode);
    const canonicalId = randomUUID();
    const created = await this.client.set(
      aliasKey,
      canonicalId,
      'EX',
      this.idleLobbyTtlSeconds,
      'NX',
    );
    if (created === null) {
      return null;
    }
    await this.registerLobby(canonicalId, normalizedCode);
    return canonicalId;
  }

  public async registerLobby(canonicalLobbyId: string, lobbyCode: string): Promise<void> {
    const ttlSeconds = this.idleLobbyTtlSeconds;
    const metaKey = this.metaKey(canonicalLobbyId);
    await this.client
      .multi()
      .hset(metaKey, RedisKeySegment.Meta, '1', RedisKeySegment.LobbyCode, lobbyCode)
      .expire(metaKey, ttlSeconds)
      .expire(this.membersKey(canonicalLobbyId), ttlSeconds)
      .exec();
  }

  public async refreshLobbyActivity(canonicalLobbyId: string, lobbyCode: string): Promise<void> {
    const nk = normalizeLobbyCode(lobbyCode);
    const ttlSeconds = this.idleLobbyTtlSeconds;
    const rawMembers = await this.client.hgetall(this.membersKey(canonicalLobbyId));
    const pipeline = this.client.multi();
    pipeline.expire(this.aliasKey(nk), ttlSeconds);
    pipeline.expire(this.metaKey(canonicalLobbyId), ttlSeconds);
    pipeline.expire(this.membersKey(canonicalLobbyId), ttlSeconds);
    const memberTokens = Object.keys(rawMembers);
    for (let i = 0; i < memberTokens.length; i += 1) {
      pipeline.expire(this.sessionLobbyKey(memberTokens[i]), ttlSeconds);
    }
    await pipeline.exec();
  }

  public async addMember(
    lobbyId: string,
    lobbyCode: string,
    member: LobbyMemberRedisRecord,
  ): Promise<void> {
    const ttlSeconds = this.idleLobbyTtlSeconds;
    const membersKey = this.membersKey(lobbyId);
    await this.client
      .multi()
      .hset(membersKey, member.sessionToken, JSON.stringify(member))
      .set(this.sessionLobbyKey(member.sessionToken), lobbyId, 'EX', ttlSeconds)
      .expire(membersKey, ttlSeconds)
      .exec();
  }

  public async removeMember(lobbyId: string, sessionToken: string): Promise<void> {
    await this.client
      .multi()
      .hdel(this.membersKey(lobbyId), sessionToken)
      .del(this.sessionLobbyKey(sessionToken))
      .exec();
  }

  public async isMember(lobbyId: string, sessionToken: string): Promise<boolean> {
    const raw = await this.client.hget(this.membersKey(lobbyId), sessionToken);
    return raw !== null;
  }

  public async listHumanMembers(lobbyId: string): Promise<LobbyMemberRedisRecord[]> {
    const raw = await this.client.hgetall(this.membersKey(lobbyId));
    const members: LobbyMemberRedisRecord[] = [];
    const keys = Object.keys(raw);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const value = raw[key];
      if (value === undefined) {
        continue;
      }
      const parsed = JSON.parse(value) as LobbyMemberRedisRecord;
      if (!parsed.isBot) {
        members.push(parsed);
      }
    }
    return members;
  }

  public async deleteLobby(canonicalLobbyId: string, lobbyCode: string): Promise<void> {
    const members = await this.client.hgetall(this.membersKey(canonicalLobbyId));
    const sessionKeys: string[] = [];
    const memberTokens = Object.keys(members);
    for (let i = 0; i < memberTokens.length; i += 1) {
      sessionKeys.push(this.sessionLobbyKey(memberTokens[i]));
    }
    const pipeline = this.client
      .multi()
      .del(this.metaKey(canonicalLobbyId))
      .del(this.membersKey(canonicalLobbyId))
      .del(this.aliasKey(normalizeLobbyCode(lobbyCode)));
    if (sessionKeys.length > 0) {
      pipeline.del(...sessionKeys);
    }
    await pipeline.exec();
  }

  private metaKey(lobbyId: string): string {
    return `${RedisKeyPrefix.LobbyMeta}:${lobbyId}:${RedisKeySegment.Meta}`;
  }

  private membersKey(lobbyId: string): string {
    return `${RedisKeyPrefix.LobbyMembers}:${lobbyId}:${RedisKeySegment.Members}`;
  }

  private sessionLobbyKey(sessionToken: string): string {
    return `${RedisKeyPrefix.SessionLobby}:${sessionToken}:${RedisKeySegment.Lobby}`;
  }

  private aliasKey(normalizedLobbyCode: string): string {
    return `${RedisKeyPrefix.LobbyAlias}:${normalizedLobbyCode}`;
  }
}
