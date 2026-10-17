import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SelectComponent } from '../../../../shared/components/select/select.component';
import { SelectOption } from '../../../../shared/components/select-option/select-option';
import { ProfileSettings } from '../../../../core/services/profile-settings';
import type { ThemeMode } from '../../../../core/db/tracker-db';

@Component({
  selector: 'app-profile',
  imports: [SelectComponent, TranslatePipe, SelectOption],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class ProfileComponent {
  private readonly document = inject(DOCUMENT);
  translationService = inject(TranslateService);
  private readonly profileSettingsService = inject(ProfileSettings);

  readonly selectedLanguage = computed(
    () => this.profileSettingsService.entry()?.language ?? this.translationService.currentLang(),
  );
  readonly selectedTheme = computed(() => this.profileSettingsService.entry()?.theme ?? 'dark');

  private applyTheme(theme: ThemeMode): void {
    this.document.body.dataset['theme'] = theme;
    this.document.body.classList.toggle('theme-dark', theme === 'dark');
    this.document.body.classList.toggle('theme-light', theme === 'light');
  }

  toggleTheme(): void {
    const nextTheme: ThemeMode = this.selectedTheme() === 'dark' ? 'light' : 'dark';

    this.applyTheme(nextTheme);
    this.profileSettingsService.saveProfileSettings(
      this.translationService.currentLang() ?? 'en',
      nextTheme,
    );
  }

  switchLanguage(lang: string) {
    this.translationService.use(lang);
    this.profileSettingsService.saveProfileSettings(lang, this.selectedTheme());
  }
}
