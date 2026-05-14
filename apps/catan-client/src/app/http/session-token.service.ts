import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SessionTokenService {
  private readonly storageKey = 'catan.sessionToken';

  public token(): string {
    return this.readFromStorage();
  }

  public ensureToken(): string {
    let t = this.readFromStorage();
    if (!this.isUuid(t)) {
      t = crypto.randomUUID();
      localStorage.setItem(this.storageKey, t);
    }
    return t;
  }

  public setTokenFromServer(token: string): void {
    localStorage.setItem(this.storageKey, token);
  }

  public clear(): void {
    localStorage.removeItem(this.storageKey);
  }

  private readFromStorage(): string {
    return localStorage.getItem(this.storageKey) ?? '';
  }

  private isUuid(value: string): boolean {
    return /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value);
  }
}
