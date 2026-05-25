import { Routes } from '@angular/router';
import { sessionGuard } from './core/guards/session.guard';

export const appRoutes: Routes = [
  { path: '', redirectTo: 'sign-in', pathMatch: 'full' },
  {
    path: 'sign-in',
    loadComponent: () => import('./features/session-shell/sign-in').then((m) => m.SignIn),
  },
  {
    path: 'join',
    canActivate: [sessionGuard],
    loadComponent: () => import('./features/session-shell/join-lobby').then((m) => m.JoinLobby),
  },
  {
    path: 'lobby/:lobbyCode',
    canActivate: [sessionGuard],
    loadComponent: () =>
      import('./features/session-shell/lobby-parent').then((m) => m.LobbyParent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/session-shell/lobby-screen').then((m) => m.LobbyScreen),
      },
      {
        path: 'game',
        loadComponent: () =>
          import('./features/session-shell/session-shell').then((m) => m.SessionShell),
      },
    ],
  },
  { path: '**', redirectTo: 'sign-in' },
];
