import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ApiGlobalPathPrefix,
  CreateLobbyResponseDto,
  DevelopmentApiOrigin,
  HttpApiRelativePath,
} from '@catan/api-interfaces';

interface ApiEnvelope<T> {
  readonly data: T;
}

@Injectable({ providedIn: 'root' })
export class LobbyApiService {
  private readonly http = inject(HttpClient);

  public async createLobby(): Promise<string> {
    const url = `${DevelopmentApiOrigin.LocalHttp}/${ApiGlobalPathPrefix.Rest}/${HttpApiRelativePath.LobbyCreate}`;
    const envelope = await firstValueFrom(this.http.post<ApiEnvelope<CreateLobbyResponseDto>>(url, {}));
    return envelope.data.lobbyId;
  }
}
