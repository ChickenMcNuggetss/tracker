import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { DayDetailsComponent } from './day-details.component';

class MockTranslateLoader implements TranslateLoader {
  getTranslation(lang: string) {
    const translationsByLang = {
      en: {
        Medium: 'Medium',
        Cramps: 'Cramps',
        Headache: 'Headache',
        CalmFocused: 'Calm & focused',
        Happy: 'Happy',
        Sensitive: 'Sensitive',
        LowEnergy: 'Low energy',
        Irritated: 'Irritated',
        None: 'None',
        Light: 'Light',
        Heavy: 'Heavy',
        Bloating: 'Bloating',
        Acne: 'Acne',
        Tender: 'Tender',
        Fatigue: 'Fatigue',
        NoFlowLogged: 'No flow logged',
        NoMoodLogged: 'No mood logged',
      },
      ru: {
        Medium: 'Средний',
        Cramps: 'Спазмы',
        Headache: 'Головная боль',
        CalmFocused: 'Спокойная и сосредоточенная',
        Happy: 'Счастливая',
        Sensitive: 'Чувствительная',
        LowEnergy: 'Низкая энергия',
        Irritated: 'Раздражительная',
        None: 'Нет',
        Light: 'Легкий',
        Heavy: 'Тяжелый',
        Bloating: 'Отек',
        Acne: 'Акне',
        Tender: 'Чувствительность',
        Fatigue: 'Усталость',
        NoFlowLogged: 'Нет записей о кровотечении',
        NoMoodLogged: 'Настроение не зафиксировано',
      },
    };

    return of(translationsByLang[lang as keyof typeof translationsByLang] ?? translationsByLang.en);
  }
}

describe('DayDetailsComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DayDetailsComponent],
      providers: [
        provideTranslateService({
          loader: { provide: TranslateLoader, useClass: MockTranslateLoader },
          fallbackLang: 'en',
          lang: 'en',
        }),
      ],
    });
  });

  it('renders log data and emits edit requests', () => {
    const fixture = TestBed.createComponent(DayDetailsComponent);
    const translate = TestBed.inject(TranslateService);

    let editRequested = false;

    fixture.componentRef.setInput('dateLabel', 'Thursday, June 4');
    fixture.componentRef.setInput('entry', {
      dateKey: '2026-06-04',
      flowIntensity: 'medium',
      symptoms: ['cramps', 'headache'],
      mood: 'calm',
      sexualActivity: false,
      vaginalDischarge: true,
      notes: 'Felt better after rest.',
      createdAt: '2026-06-04T10:00:00.000Z',
      updatedAt: '2026-06-04T12:00:00.000Z',
    });
    fixture.componentInstance.editRequested.subscribe(() => {
      editRequested = true;
    });
    fixture.detectChanges();

    let compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Thursday, June 4');
    expect(compiled.textContent).toContain('Medium');
    expect(compiled.textContent).toContain('Cramps');
    expect(compiled.textContent).toContain('Headache');
    expect(compiled.textContent).toContain('Calm & focused');

    translate.use('ru');
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Средний');
    expect(compiled.textContent).toContain('Спазмы');
    expect(compiled.textContent).toContain('Головная боль');
    expect(compiled.textContent).toContain('Спокойная и сосредоточенная');

    compiled
      .querySelector('.day-details-edit')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(editRequested).toBe(true);
  });
});
