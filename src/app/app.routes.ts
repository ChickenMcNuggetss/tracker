import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home-page').then((c) => c.HomePage),
  },
  {
    path: 'calendar',
    loadComponent: () => import('./pages/calendar-page/calendar-page').then((c) => c.CalendarPage),
  },
  {
    path: 'logs',
    loadComponent: () => import('./pages/logs-page/logs-page').then((c) => c.LogsPage),
  },
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile-page/profile-page').then((c) => c.ProfilePage),
  },
];
