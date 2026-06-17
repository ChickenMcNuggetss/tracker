import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CycleSettingsService } from '../services/cycle-settings.service';

export const requireCycleSettingsGuard: CanActivateFn = async () => {
  const cycleSettingsService = inject(CycleSettingsService);
  const router = inject(Router);

  return (await cycleSettingsService.hasSavedCycleSettings())
    ? true
    : router.createUrlTree(['/onboarding']);
};

export const redirectIfCycleSettingsExistGuard: CanActivateFn = async () => {
  const cycleSettingsService = inject(CycleSettingsService);
  const router = inject(Router);

  return (await cycleSettingsService.hasSavedCycleSettings())
    ? router.createUrlTree(['/home'])
    : true;
};
