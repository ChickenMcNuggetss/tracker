import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { CycleSettingsService } from '../services/cycle-settings.service';

export const requireCycleSettingsGuard: CanActivateFn = async () => {
  const cycleSettings = inject(CycleSettingsService);
  const router = inject(Router);

  return (await cycleSettings.hasSavedCycleSettings())
    ? true
    : router.createUrlTree(['/onboarding']);
};

export const redirectIfCycleSettingsExistGuard: CanActivateFn = async () => {
  const cycleSettings = inject(CycleSettingsService);
  const router = inject(Router);

  return (await cycleSettings.hasSavedCycleSettings())
    ? router.createUrlTree(['/home'])
    : true;
};
