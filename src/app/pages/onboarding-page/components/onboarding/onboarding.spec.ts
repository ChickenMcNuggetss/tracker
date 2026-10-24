import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import {
  provideTranslateLoader,
  provideTranslateService,
  TranslateLoader,
} from '@ngx-translate/core';
import { of } from 'rxjs';
import { CycleSettingsService } from '../../../../core/services/cycle-settings.service';
import { OnboardingComponent } from './onboarding';

class TestTranslateLoader extends TranslateLoader {
  override getTranslation() {
    return of({
      OnboardingWelcome: 'Welcome',
      OnboardingTitle: "Let's set up your cycle",
      OnboardingDescription: 'Answer these two questions to personalize your dashboard',
      OnboardingCycleLengthQuestion: 'What is your average cycle length?',
      OnboardingPeriodLengthQuestion: 'What is your average period length?',
      OnboardingContinue: 'Continue',
      OnboardingFormError: 'Enter a whole number greater than zero',
    });
  }
}

describe('OnboardingComponent', () => {
  const saveCycleSettings = vi.fn().mockResolvedValue(undefined);
  const navigateByUrl = vi.fn().mockResolvedValue(true);

  beforeEach(async () => {
    saveCycleSettings.mockClear();
    navigateByUrl.mockClear();

    await TestBed.configureTestingModule({
      imports: [OnboardingComponent],
      providers: [
        provideTranslateService({
          loader: provideTranslateLoader(() => new TestTranslateLoader()),
          fallbackLang: 'en',
          lang: 'en',
        }),
        { provide: CycleSettingsService, useValue: { saveCycleSettings } },
        { provide: Router, useValue: { navigateByUrl } },
      ],
    }).compileComponents();
  });

  it('collects cycle and period length', () => {
    const fixture = TestBed.createComponent(OnboardingComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('What is your average cycle length?');
    expect(element.textContent).toContain('What is your average period length?');
    expect(element.querySelectorAll('input')).toHaveLength(2);
  });

  it('saves valid settings and continues to home', async () => {
    const fixture = TestBed.createComponent(OnboardingComponent);
    fixture.detectChanges();
    const inputs = fixture.debugElement.queryAll(By.css('input'));

    for (const [input, value] of [[inputs[0], '30'], [inputs[1], '6']] as const) {
      input.nativeElement.value = value;
      input.nativeElement.dispatchEvent(new Event('input'));
    }

    await fixture.componentInstance.save();

    expect(saveCycleSettings).toHaveBeenCalledWith({ cycleLength: 30, periodLength: 6 });
    expect(navigateByUrl).toHaveBeenCalledWith('/home');
  });
});
