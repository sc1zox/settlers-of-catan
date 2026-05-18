import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  ApiGlobalPathPrefix,
  HttpApiRelativePath,
  LobbyRejoinAvailableRequestDto,
  LobbyRejoinAvailableResponseDto,
} from '@catan/api-interfaces';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class LobbyHttpService {
  private readonly http = inject(HttpClient);

  public checkRejoinAvailable(
    lobbyCode: string,
  ): Observable<LobbyRejoinAvailableResponseDto> {
    const url = `${environment.apiBaseUrl}/${ApiGlobalPathPrefix.Rest}/${HttpApiRelativePath.LobbyRejoinAvailable}`;
    const body: LobbyRejoinAvailableRequestDto = { lobbyCode };
    return this.http.post<LobbyRejoinAvailableResponseDto>(url, body);
  }
}
