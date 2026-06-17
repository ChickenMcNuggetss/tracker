import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CycleSettingsService } from '../../../../core/services/cycle-settings.service';

const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;

@Component({
  selector: 'app-onboarding',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.scss',
})
export class OnboardingComponent {
  private readonly cycleSettingsService = inject(CycleSettingsService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly isSaving = signal(false);

  readonly form = this.fb.group({
    cycleLength: this.fb.nonNullable.control('', {
      validators: [Validators.required, Validators.pattern(POSITIVE_INTEGER_PATTERN)],
    }),
    periodLength: this.fb.nonNullable.control('', {
      validators: [Validators.required, Validators.pattern(POSITIVE_INTEGER_PATTERN)],
    }),
  });

  async save(): Promise<void> {
    if (this.form.invalid || this.isSaving()) {
      this.form.markAllAsTouched();
      return;
    }

    const { cycleLength, periodLength } = this.form.getRawValue();

    this.isSaving.set(true);

    try {
      await this.cycleSettingsService.saveCycleSettings({
        cycleLength: Number(cycleLength),
        periodLength: Number(periodLength),
      });

      await this.router.navigateByUrl('/home');
    } finally {
      this.isSaving.set(false);
    }
  }
}
