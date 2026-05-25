import {
  HttpBackend,
  HttpErrorResponse,
  HttpHeaders,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import {
  ApiEnvelopeFieldKey,
  ApiGlobalPathPrefix,
  extractApiErrorCodeFromBody,
  extractApiErrorCodeFromHttpStatus,
  InternalApiErrorCode,
  normalizeUserFacingErrorCode,
  UserFacingErrorCode,
} from '@catan/api-interfaces';
import { ClientStorageKey, SessionHttpAction, SessionRestPath } from '../../../shared/client-constants';
import { Observable, catchError, filter, firstValueFrom, map, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PlayerSessionService {
  private readonly backend = inject(HttpBackend);

  private readonly accessSignal = signal('');

  private readonly failureCodeSignal = signal<UserFacingErrorCode | null>(null);

  private lastChain: Promise<void> = Promise.resolve();

  public accessToken(): string {
    return this.accessSignal();
  }

  public sessionId(): string {
    return this.readSessionId();
  }

  public failureCode(): UserFacingErrorCode | null {
    return this.failureCodeSignal();
  }

  public recordHttpFailure(err: unknown): void {
    this.recordFailure(err);
  }

  public clear(): void {
    localStorage.removeItem(ClientStorageKey.PlayerSessionId);
    localStorage.removeItem(ClientStorageKey.AccessToken);
    localStorage.removeItem(ClientStorageKey.RefreshToken);
    localStorage.removeItem(ClientStorageKey.SessionToken);
    this.accessSignal.set('');
    this.failureCodeSignal.set(null);
    void this.postLogout();
  }

  public ensureReady(): Promise<void> {
    const next = this.lastChain.then(() => this.hydrateFromStorageOrNetwork());
    this.lastChain = next.catch(() => undefined);
    return next;
  }

  public tryRefresh(): Observable<boolean> {
    const url = this.buildSessionUrl(SessionHttpAction.Refresh);
    const req = new HttpRequest('POST', url, JSON.stringify({}), {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
      withCredentials: true,
    });
    return this.backend.handle(req).pipe(
      filter((e): e is HttpResponse<unknown> => e instanceof HttpResponse),
      map((e) => {
        const ok = this.applyBundleFromUnknown(e.body);
        if (ok) {
          this.clearFailure();
        }
        return ok;
      }),
      catchError((err: unknown) => {
        this.recordFailure(err);
        return of(false);
      }),
    );
  }

  private async hydrateFromStorageOrNetwork(): Promise<void> {
    this.clearFailure();
    const sessionId = this.readSessionId();
    if (sessionId.length === 0) {
      await this.postBootstrap();
      return;
    }
    const access = this.readAccess();
    if (access.length > 0 && !this.isJwtNearExpiry(access, 60)) {
      this.accessSignal.set(access);
      return;
    }
    const refreshed = await firstValueFrom(this.tryRefresh());
    if (refreshed) {
      return;
    }
    await this.postBootstrap();
  }

  private async postBootstrap(): Promise<void> {
    const url = this.buildSessionUrl(SessionHttpAction.Bootstrap);
    const req = new HttpRequest('POST', url, JSON.stringify({}), {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
      withCredentials: true,
    });
    try {
      const ev = await firstValueFrom(
        this.backend.handle(req).pipe(
          filter((e): e is HttpResponse<unknown> => e instanceof HttpResponse),
          catchError((err: unknown) => {
            this.recordFailure(err);
            return throwError(() => err);
          }),
        ),
      );
      const ok = this.applyBundleFromUnknown(ev.body);
      if (!ok) {
        this.recordFailure(undefined);
        this.clearLocalOnly();
        return;
      }
      this.clearFailure();
    } catch {
      this.clearLocalOnly();
    }
  }

  private async postLogout(): Promise<void> {
    const url = this.buildSessionUrl(SessionHttpAction.Logout);
    const req = new HttpRequest('POST', url, null, {
      withCredentials: true,
    });
    try {
      await firstValueFrom(
        this.backend.handle(req).pipe(filter((e): e is HttpResponse<unknown> => e instanceof HttpResponse)),
      );
    } catch {
      // Cookie may already be absent.
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
    if (typeof sessionId !== 'string' || typeof accessToken !== 'string') {
      return false;
    }
    localStorage.setItem(ClientStorageKey.PlayerSessionId, sessionId);
    localStorage.removeItem(ClientStorageKey.AccessToken);
    localStorage.removeItem(ClientStorageKey.RefreshToken);
    localStorage.removeItem(ClientStorageKey.SessionToken);
    this.accessSignal.set(accessToken);
    return true;
  }

  private clearLocalOnly(): void {
    localStorage.removeItem(ClientStorageKey.PlayerSessionId);
    localStorage.removeItem(ClientStorageKey.AccessToken);
    localStorage.removeItem(ClientStorageKey.RefreshToken);
    localStorage.removeItem(ClientStorageKey.SessionToken);
    this.accessSignal.set('');
  }

  private recordFailure(err: unknown): void {
    if (err instanceof HttpErrorResponse) {
      const fromBody = extractApiErrorCodeFromBody(err.error);
      if (fromBody !== undefined) {
        const normalized = normalizeUserFacingErrorCode(fromBody);
        if (normalized !== undefined) {
          this.failureCodeSignal.set(normalized);
          return;
        }
      }
      const fromStatus = extractApiErrorCodeFromHttpStatus(err.status);
      if (fromStatus !== undefined) {
        const normalized = normalizeUserFacingErrorCode(fromStatus);
        if (normalized !== undefined) {
          this.failureCodeSignal.set(normalized);
          return;
        }
      }
    }
    if (err instanceof Error) {
      const normalized = normalizeUserFacingErrorCode(err.message);
      if (normalized !== undefined) {
        this.failureCodeSignal.set(normalized);
        return;
      }
    }
    this.failureCodeSignal.set(InternalApiErrorCode.Unexpected);
  }

  private clearFailure(): void {
    this.failureCodeSignal.set(null);
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
    return this.accessSignal();
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

  private buildSessionUrl(action: string): string {
    return `${environment.apiBaseUrl}/${ApiGlobalPathPrefix.Rest}/${SessionRestPath.Prefix}/${action}`;
  }
}
