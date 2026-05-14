import { IsString, MaxLength, MinLength } from 'class-validator';

export class PingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  public message!: string;
}
