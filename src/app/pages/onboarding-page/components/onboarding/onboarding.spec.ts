import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { CycleSettingsService } from '../../core/services/cycle-settings.service';
import { OnboardingPage } from './onboarding';

describe('OnboardingPage', () => {
  const saveCycleSettings = vi.fn().mockResolvedValue(undefined);
  const router = {
    navigateByUrl: vi.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    saveCycleSettings.mockClear();
    router.navigateByUrl.mockClear();

    await TestBed.configureTestingModule({
      imports: [OnboardingPage],
      providers: [
        {
          provide: CycleSettingsService,
          useValue: {
            saveCycleSettings,
          },
        },
        {
          provide: Router,
          useValue: router,
        },
      ],
    }).compileComponents();
  });

  it('renders only the onboarding questions and continue action', () => {
    const fixture = TestBed.createComponent(OnboardingPage);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('What is your average cycle length?');
    expect(compiled.textContent).toContain('What is your average period length?');
    expect(compiled.textContent).toContain('Continue');
    expect(compiled.textContent).not.toContain('Profile');
    expect(compiled.textContent).not.toContain('Calendar');
  });

  it('saves cycle settings and continues to the dashboard', async () => {
    const fixture = TestBed.createComponent(OnboardingPage);
    fixture.detectChanges();

    const inputs = fixture.debugElement.queryAll(By.css('input'));
    const cycleLengthInput = inputs[0].nativeElement as HTMLInputElement;
    const periodLengthInput = inputs[1].nativeElement as HTMLInputElement;

    cycleLengthInput.value = '30';
    cycleLengthInput.dispatchEvent(new Event('input'));
    periodLengthInput.value = '6';
    periodLengthInput.dispatchEvent(new Event('input'));

    await fixture.componentInstance.save();

    expect(saveCycleSettings).toHaveBeenCalledWith({
      cycleLength: 30,
      periodLength: 6,
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/home');
  });
});
