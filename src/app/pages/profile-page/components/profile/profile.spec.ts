import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import {
  TranslateLoader,
  provideTranslateLoader,
  provideTranslateService,
} from '@ngx-translate/core';
import { ProfileSettings } from '../../../../core/services/profile-settings';
import { CycleSettingsService } from '../../../../core/services/cycle-settings.service';
import { ProfileComponent } from './profile';

class TestTranslateLoader extends TranslateLoader {
  override getTranslation() {
    return of({
      Profile: 'Profile',
      LanguageSettings: 'Language settings',
      ThemeSettings: 'Theme settings',
      CycleSettings: 'Cycle settings',
      CycleSettingsDescription: 'Set your cycle length and period length',
      CycleLength: 'Cycle length',
      PeriodLength: 'Period length',
      CycleLengthHelp: 'Whole number of days in your cycle',
      PeriodLengthHelp: 'Whole number of days you expect your period to last',
      SaveSettings: 'Save settings',
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
  const saveCycleSettings = vi.fn().mockResolvedValue(undefined);
  const resolvedSettings = signal({ cycleLength: 30, periodLength: 6 });

  beforeEach(async () => {
    saveProfileSettings.mockClear();
    saveCycleSettings.mockClear();
    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideTranslateService({
          loader: provideTranslateLoader(() => new TestTranslateLoader()),
          fallbackLang: 'en',
          lang: 'en',
        }),
        { provide: ProfileSettings, useValue: { entry, saveProfileSettings } },
        {
          provide: CycleSettingsService,
          useValue: { resolvedSettings, saveCycleSettings },
        },
      ],
    }).compileComponents();
  });

  it('renders cycle, language, and theme settings', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('#profile-title')?.textContent).toContain('Profile');
    expect(element.textContent).toContain('Language settings');
    expect(element.textContent).toContain('Theme settings');
    expect(element.textContent).toContain('Cycle length');
    expect(element.textContent).toContain('Period length');
  });

  it('loads and saves cycle settings', async () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    const inputs = fixture.debugElement.queryAll(By.css('input'));

    expect(inputs[0].nativeElement.value).toBe('30');
    expect(inputs[1].nativeElement.value).toBe('6');

    for (const [input, value] of [[inputs[0], '32'], [inputs[1], '7']] as const) {
      input.nativeElement.value = value;
      input.nativeElement.dispatchEvent(new Event('input'));
    }

    await fixture.componentInstance.save();

    expect(saveCycleSettings).toHaveBeenCalledWith({ cycleLength: 32, periodLength: 7 });
  });

  it('persists a theme change as a local profile preference', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();

    fixture.componentInstance.toggleTheme();

    expect(saveProfileSettings).toHaveBeenCalledWith('en', 'light');
  });
});
