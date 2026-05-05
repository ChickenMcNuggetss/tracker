import { Routes } from '@angular/router';
import { HomePage } from './pages/home/home-page';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home-page').then((c) => c.HomePage),
  }
];
