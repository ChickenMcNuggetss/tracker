import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import {
  TranslateLoader,
  provideTranslateLoader,
  provideTranslateService,
} from '@ngx-translate/core';
import { ProfileSettings } from '../../../../core/services/profile-settings';
import { ProfileComponent } from './profile';

class TestTranslateLoader extends TranslateLoader {
  override getTranslation() {
    return of({
      Profile: 'Profile',
      LanguageSettings: 'Language settings',
      ThemeSettings: 'Theme settings',
    });
  }
}

describe('ProfileComponent', () => {
  const entry = signal({
    id: 'default' as const,
    language: 'en',
    theme: 'dark' as const,
    updatedAt: '2026-10-17T00:00:00.000Z',
  });
  const saveProfileSettings = vi.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    saveProfileSettings.mockClear();
    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideTranslateService({
          loader: provideTranslateLoader(() => new TestTranslateLoader()),
          fallbackLang: 'en',
          lang: 'en',
        }),
        { provide: ProfileSettings, useValue: { entry, saveProfileSettings } },
      ],
    }).compileComponents();
  });

  it('renders language and theme preferences without cycle settings', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('#profile-title')?.textContent).toContain('Profile');
    expect(element.textContent).toContain('Language settings');
    expect(element.textContent).toContain('Theme settings');
    expect(element.textContent).not.toContain('Cycle length');
    expect(element.textContent).not.toContain('Period length');
  });

  it('persists a theme change as a local profile preference', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();

    fixture.componentInstance.toggleTheme();

    expect(saveProfileSettings).toHaveBeenCalledWith('en', 'light');
  });
});
