import { TestBed } from '@angular/core/testing';
import { CurrentCycleDayCardComponent } from './current-cycle-day-card.component';

describe('CurrentCycleDayCardComponent', () => {
  it('renders the cycle day value', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [CurrentCycleDayCardComponent],
    }).createComponent(CurrentCycleDayCardComponent);

    fixture.componentRef.setInput('cycleDay', 7);
    fixture.componentRef.setInput('cycleLength', 28);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('7');
    expect(compiled.textContent).toContain('28-day cycle');
  });

  it('renders an empty state when no value is available', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [CurrentCycleDayCardComponent],
    }).createComponent(CurrentCycleDayCardComponent);

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('--');
    expect(compiled.textContent).toContain('Add a period day in Calendar');
  });
});
