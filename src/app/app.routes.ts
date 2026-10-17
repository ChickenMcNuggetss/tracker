import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home-page').then((c) => c.HomePage),
  },
  {
    path: 'calendar',
    loadComponent: () => import('./pages/calendar-page/calendar-page').then((c) => c.CalendarPage),
  },
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile-page/profile-page').then((c) => c.ProfilePage),
  },
  { path: '', redirectTo: 'home', pathMatch: 'full' },
];
