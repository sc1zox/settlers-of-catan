import { IsOptional, IsUUID } from 'class-validator';

export class SessionBootstrapDto {
  @IsOptional()
  @IsUUID('4')
  public legacySessionId?: string;
}
