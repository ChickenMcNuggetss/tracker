import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { TranslateLoader, provideTranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { CycleSettingsService } from '../../../../core/services/cycle-settings.service';
import { ProfileComponent } from './profile';

class TestTranslateLoader extends TranslateLoader {
  override getTranslation() {
    return of({});
  }
}

describe('ProfilePage', () => {
  const resolvedSettings = signal({
    cycleLength: 30,
    periodLength: 6,
  });

  const saveCycleSettings = vi.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    saveCycleSettings.mockClear();

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideTranslateService({
          loader: provideTranslateLoader(() => new TestTranslateLoader()),
          fallbackLang: 'en',
          lang: 'en',
        }),
        {
          provide: CycleSettingsService,
          useValue: {
            resolvedSettings,
            saveCycleSettings,
          },
        },
      ],
    }).compileComponents();
  });

  it('renders the cycle settings form only', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Cycle settings');
    expect(compiled.textContent).toContain('Cycle length');
    expect(compiled.textContent).toContain('Period length');
    expect(compiled.textContent).toContain('Save settings');
    expect(compiled.textContent).not.toContain('Avatar');
    expect(compiled.textContent).not.toContain('History');
  });

  it('loads the saved settings into the form and persists edits', async () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();

    const inputs = fixture.debugElement.queryAll(By.css('input'));
    const cycleLengthInput = inputs[0].nativeElement as HTMLInputElement;
    const periodLengthInput = inputs[1].nativeElement as HTMLInputElement;

    expect(cycleLengthInput.value).toBe('30');
    expect(periodLengthInput.value).toBe('6');

    cycleLengthInput.value = '32';
    cycleLengthInput.dispatchEvent(new Event('input'));
    periodLengthInput.value = '7';
    periodLengthInput.dispatchEvent(new Event('input'));

    await fixture.componentInstance.save();

    expect(saveCycleSettings).toHaveBeenCalledWith({
      cycleLength: 32,
      periodLength: 7,
    });
  });
});
