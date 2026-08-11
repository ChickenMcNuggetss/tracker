import { Routes } from '@angular/router';
// import { AppShell } from './app-shell.component';
import {
  requireCycleSettingsGuard,
  redirectIfCycleSettingsExistGuard,
} from './core/guards/cycle-settings.guard';

export const routes: Routes = [
  {
    path: 'onboarding',
    loadComponent: () =>
      import('./pages/onboarding-page/onboarding-page').then((c) => c.OnboardingPage),
    canActivate: [redirectIfCycleSettingsExistGuard],
  },
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home-page').then((c) => c.HomePage),
    canActivate: [requireCycleSettingsGuard],
  },
  {
    path: 'calendar',
    loadComponent: () => import('./pages/calendar-page/calendar-page').then((c) => c.CalendarPage),
    canActivate: [requireCycleSettingsGuard],
  },
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile-page/profile-page').then((c) => c.ProfilePage),
    canActivate: [requireCycleSettingsGuard],
  },
  { path: '', redirectTo: 'home', pathMatch: 'full' }
];
