import { IsOptional, IsString, MinLength } from 'class-validator';

export class SessionRefreshDto {
  @IsOptional()
  @IsString()
  @MinLength(20)
  public refreshToken?: string;
}
