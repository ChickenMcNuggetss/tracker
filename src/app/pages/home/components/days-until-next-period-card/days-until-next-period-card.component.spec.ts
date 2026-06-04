import { TestBed } from '@angular/core/testing';
import { DaysUntilNextPeriodCardComponent } from './days-until-next-period-card.component';

describe('DaysUntilNextPeriodCardComponent', () => {
  it('renders the countdown value', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [DaysUntilNextPeriodCardComponent],
    }).createComponent(DaysUntilNextPeriodCardComponent);

    fixture.componentRef.setInput('daysUntilNextPeriod', 3);
    fixture.componentRef.setInput('cycleLength', 30);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('3');
    expect(compiled.textContent).toContain('30-day cycle');
  });

  it('renders an empty state when no value is available', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [DaysUntilNextPeriodCardComponent],
    }).createComponent(DaysUntilNextPeriodCardComponent);

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('--');
    expect(compiled.textContent).toContain('Add a period day in Calendar');
  });
});
