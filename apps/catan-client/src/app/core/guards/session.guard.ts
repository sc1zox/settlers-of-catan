import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ClientStorageKey } from '../../../shared/client-constants';
import { PlayerSessionService } from '../session/player-session.service';

export const sessionGuard: CanActivateFn = async () => {
  const session = inject(PlayerSessionService);
  const router = inject(Router);
  await session.ensureReady();
  if (session.sessionId().length === 0) {
    return router.createUrlTree(['/sign-in']);
  }
  const displayName = localStorage.getItem(ClientStorageKey.DisplayName) ?? '';
  if (displayName.length === 0) {
    return router.createUrlTree(['/sign-in']);
  }
  return true;
};
