import { Module } from '@nestjs/common';
import { LiveKitRoomService } from './livekit/livekit-room.service';
import { RedisLobbyStoreService } from './redis/redis-lobby-store.service';

@Module({
  providers: [RedisLobbyStoreService, LiveKitRoomService],
  exports: [RedisLobbyStoreService, LiveKitRoomService],
})
export class InfrastructureModule {}
