import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';

const WINDOW_MS = 60_000;
const MAX_BOOTSTRAPS_PER_WINDOW = 30;

interface WindowState {
  count: number;
  windowStartMs: number;
}

@Injectable()
export class SessionBootstrapRateLimitService {
  private readonly byIp = new Map<string, WindowState>();

  public assertAllowed(req: Request): void {
    const ip = this.resolveClientIp(req);
    const now = Date.now();
    let state = this.byIp.get(ip);
    if (state === undefined || now - state.windowStartMs >= WINDOW_MS) {
      state = { count: 0, windowStartMs: now };
      this.byIp.set(ip, state);
    }
    state.count += 1;
    if (state.count > MAX_BOOTSTRAPS_PER_WINDOW) {
      throw new HttpException('Too many session bootstrap attempts', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private resolveClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      const first = forwarded.split(',')[0]?.trim();
      if (first !== undefined && first.length > 0) {
        return first;
      }
    }
    return req.ip ?? 'unknown';
  }
}
