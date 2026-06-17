import { TestBed } from '@angular/core/testing';
import { DayDetailsComponent } from './day-details.component';

describe('DayDetailsComponent', () => {
  it('renders log data and emits edit requests', () => {
    const fixture = TestBed.configureTestingModule({
      imports: [DayDetailsComponent],
    }).createComponent(DayDetailsComponent);

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

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Thursday, June 4');
    expect(compiled.textContent).toContain('Medium');
    expect(compiled.textContent).toContain('Cramps');
    expect(compiled.textContent).toContain('Headache');
    expect(compiled.textContent).toContain('Calm & focused');

    compiled.querySelector('.day-details-edit')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(editRequested).toBe(true);
  });
});
