import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CycleSettingsService } from '../../../../core/services/cycle-settings.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SelectComponent } from '../../../../shared/components/select/select.component';
import { SelectOption } from "../../../../shared/components/select-option/select-option";

const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, SelectComponent, TranslatePipe, SelectOption],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class ProfileComponent {
  private readonly cycleSettingsService = inject(CycleSettingsService);
  private readonly fb = inject(FormBuilder);
  translationService = inject(TranslateService);

  readonly isSaving = signal(false);
  readonly selectedLanguage = this.translationService.currentLang;

  readonly form = this.fb.group({
    cycleLength: this.fb.nonNullable.control('', {
      validators: [Validators.required, Validators.pattern(POSITIVE_INTEGER_PATTERN)],
    }),
    periodLength: this.fb.nonNullable.control('', {
      validators: [Validators.required, Validators.pattern(POSITIVE_INTEGER_PATTERN)],
    }),
  });

  private readonly syncFormWithSettings = effect(() => {
    const settings = this.cycleSettingsService.resolvedSettings();

    this.form.patchValue(
      {
        cycleLength: `${settings.cycleLength}`,
        periodLength: `${settings.periodLength}`,
      },
      { emitEvent: false },
    );
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
      this.form.markAsPristine();
    } finally {
      this.isSaving.set(false);
    }
  }

  switchLanguage(lang: string) {
    this.translationService.use(lang);
  }
}
