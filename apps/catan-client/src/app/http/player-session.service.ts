import { HttpBackend, HttpHeaders, HttpRequest, HttpResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import {
  ApiEnvelopeFieldKey,
  ApiGlobalPathPrefix,
  ClientStorageKey,
  SessionHttpAction,
  SessionRestPath,
} from '@catan/api-interfaces';
import { Observable, catchError, filter, firstValueFrom, map, of } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PlayerSessionService {
  private readonly backend = inject(HttpBackend);

  private readonly accessSignal = signal('');

  private lastChain: Promise<void> = Promise.resolve();

  public accessToken(): string {
    return this.accessSignal();
  }

  public sessionId(): string {
    return this.readSessionId();
  }

  public clear(): void {
    localStorage.removeItem(ClientStorageKey.PlayerSessionId);
    localStorage.removeItem(ClientStorageKey.AccessToken);
    localStorage.removeItem(ClientStorageKey.RefreshToken);
    localStorage.removeItem(ClientStorageKey.SessionToken);
    this.accessSignal.set('');
  }

  public ensureReady(): Promise<void> {
    const next = this.lastChain.then(() => this.hydrateFromStorageOrNetwork());
    this.lastChain = next.catch(() => undefined);
    return next;
  }

  public tryRefresh(): Observable<boolean> {
    const refreshToken = this.readRefresh();
    if (refreshToken.length === 0) {
      return of(false);
    }
    const url = this.buildSessionUrl(SessionHttpAction.Refresh);
    const body = JSON.stringify({ refreshToken });
    const req = new HttpRequest('POST', url, body, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
    });
    return this.backend.handle(req).pipe(
      filter((e): e is HttpResponse<unknown> => e instanceof HttpResponse),
      map((e) => this.applyBundleFromUnknown(e.body)),
      catchError(() => of(false)),
    );
  }

  private async hydrateFromStorageOrNetwork(): Promise<void> {
    const sessionId = this.readSessionId();
    const refresh = this.readRefresh();
    const access = this.readAccess();
    if (
      sessionId.length > 0 &&
      refresh.length > 0 &&
      access.length > 0 &&
      !this.isJwtNearExpiry(access, 60)
    ) {
      this.accessSignal.set(access);
      return;
    }
    if (sessionId.length > 0 && refresh.length > 0) {
      const ok = await firstValueFrom(this.tryRefresh());
      if (ok) {
        return;
      }
      this.clear();
    }
    const legacy = this.readLegacyUuid();
    await this.postBootstrap(legacy);
  }

  private async postBootstrap(legacySessionId: string | undefined): Promise<void> {
    const url = this.buildSessionUrl(SessionHttpAction.Bootstrap);
    const body =
      legacySessionId !== undefined
        ? JSON.stringify({ legacySessionId })
        : JSON.stringify({});
    const req = new HttpRequest('POST', url, body, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
    });
    try {
      const ev = await firstValueFrom(
        this.backend.handle(req).pipe(
          filter((e): e is HttpResponse<unknown> => e instanceof HttpResponse),
        ),
      );
      const ok = this.applyBundleFromUnknown(ev.body);
      if (!ok) {
        this.clear();
        return;
      }
    } catch {
      this.clear();
      return;
    }
    if (legacySessionId !== undefined) {
      localStorage.removeItem(ClientStorageKey.SessionToken);
    }
  }

  private applyBundleFromUnknown(body: unknown): boolean {
    const data = this.unwrapData(body);
    if (data === undefined || typeof data !== 'object') {
      return false;
    }
    const rec = data as Record<string, unknown>;
    const sessionId = rec['sessionId'];
    const accessToken = rec['accessToken'];
    const refreshToken = rec['refreshToken'];
    if (
      typeof sessionId !== 'string' ||
      typeof accessToken !== 'string' ||
      typeof refreshToken !== 'string'
    ) {
      return false;
    }
    localStorage.setItem(ClientStorageKey.PlayerSessionId, sessionId);
    localStorage.setItem(ClientStorageKey.AccessToken, accessToken);
    localStorage.setItem(ClientStorageKey.RefreshToken, refreshToken);
    this.accessSignal.set(accessToken);
    return true;
  }

  private unwrapData(body: unknown): unknown {
    if (body !== null && typeof body === 'object' && ApiEnvelopeFieldKey.Data in body) {
      return (body as Record<string, unknown>)[ApiEnvelopeFieldKey.Data];
    }
    return body;
  }

  private readSessionId(): string {
    return localStorage.getItem(ClientStorageKey.PlayerSessionId) ?? '';
  }

  private readAccess(): string {
    return localStorage.getItem(ClientStorageKey.AccessToken) ?? '';
  }

  private readRefresh(): string {
    return localStorage.getItem(ClientStorageKey.RefreshToken) ?? '';
  }

  private readLegacyUuid(): string | undefined {
    const v = localStorage.getItem(ClientStorageKey.SessionToken) ?? '';
    if (this.isUuid(v)) {
      return v;
    }
    return undefined;
  }

  private isUuid(value: string): boolean {
    return /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value);
  }

  private isJwtNearExpiry(token: string, skewSec: number): boolean {
    const expMs = this.readJwtExpMs(token);
    if (expMs === undefined) {
      return true;
    }
    return expMs <= Date.now() + skewSec * 1000;
  }

  private readJwtExpMs(token: string): number | undefined {
    const parts = token.split('.');
    if (parts.length < 2) {
      return undefined;
    }
    try {
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = atob(b64);
      const payload = JSON.parse(json) as { exp?: number };
      if (typeof payload.exp === 'number') {
        return payload.exp * 1000;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  private buildSessionUrl(action: SessionHttpAction): string {
    return `${environment.apiBaseUrl}/${ApiGlobalPathPrefix.Rest}/${SessionRestPath.Prefix}/${action}`;
  }
}
