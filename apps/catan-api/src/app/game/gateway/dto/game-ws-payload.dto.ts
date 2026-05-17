import { PlayerSeat, ResourceType } from '@catan/api-interfaces';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class LobbyIdWsDto {
  @IsString()
  @MinLength(1)
  public lobbyId!: string;
}

export class JoinLobbyWsDto {
  @IsString()
  @MinLength(1)
  public lobbyCode!: string;

  @IsString()
  @MinLength(1)
  public displayName!: string;
}

export class CreateLobbyWsDto {
  @IsString()
  @MinLength(1)
  public lobbyCode!: string;

  @IsString()
  @MinLength(1)
  public displayName!: string;
}

export class BuildSettlementWsDto extends LobbyIdWsDto {
  @IsString()
  @MinLength(1)
  public vertexId!: string;
}

export class BuildRoadWsDto extends LobbyIdWsDto {
  @IsString()
  @MinLength(1)
  public edgeId!: string;
}

export class BuildCityWsDto extends LobbyIdWsDto {
  @IsString()
  @MinLength(1)
  public vertexId!: string;
}

export class PlayKnightWsDto extends LobbyIdWsDto {
  @IsInt()
  public q!: number;

  @IsInt()
  public r!: number;

  @IsOptional()
  @IsEnum(PlayerSeat)
  public victimSeat?: PlayerSeat;
}

export class PlayMonopolyWsDto extends LobbyIdWsDto {
  @IsEnum(ResourceType)
  public resource!: ResourceType;
}

export class PlayYearOfPlentyWsDto extends LobbyIdWsDto {
  @IsEnum(ResourceType)
  public first!: ResourceType;

  @IsEnum(ResourceType)
  public second!: ResourceType;
}

export class PlayRoadBuildingWsDto extends LobbyIdWsDto {
  @IsString()
  @MinLength(1)
  public firstEdgeId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  public secondEdgeId?: string;
}

export class BankTradeWsDto extends LobbyIdWsDto {
  @IsEnum(ResourceType)
  public giveResource!: ResourceType;

  @IsInt()
  @Min(1)
  public giveAmount!: number;

  @IsEnum(ResourceType)
  public receiveResource!: ResourceType;
}

export class RobberDiscardWsDto extends LobbyIdWsDto {
  @IsObject()
  public discard!: Partial<Record<ResourceType, number>>;
}

export class MoveRobberWsDto extends LobbyIdWsDto {
  @IsInt()
  public q!: number;

  @IsInt()
  public r!: number;

  @IsOptional()
  @IsEnum(PlayerSeat)
  public victimSeat?: PlayerSeat;
}

export class KickAndReplaceWithBotWsDto extends LobbyIdWsDto {
  @IsEnum(PlayerSeat)
  public seat!: PlayerSeat;
}

export class TradeIdWsDto extends LobbyIdWsDto {
  @IsString()
  @MinLength(1)
  public tradeId!: string;
}

export class TradeProposeWsDto extends LobbyIdWsDto {
  @IsArray()
  @IsEnum(PlayerSeat, { each: true })
  public recipients!: PlayerSeat[];

  @IsObject()
  public offer!: Partial<Record<ResourceType, number>>;

  @IsObject()
  public request!: Partial<Record<ResourceType, number>>;
}

export class TradeCounterWsDto extends TradeIdWsDto {
  @IsObject()
  public offer!: Partial<Record<ResourceType, number>>;

  @IsObject()
  public request!: Partial<Record<ResourceType, number>>;
}

export class TradeFinalizeWsDto extends TradeIdWsDto {
  @IsEnum(PlayerSeat)
  public recipientSeat!: PlayerSeat;
}
