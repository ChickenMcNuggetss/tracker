import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Calendar } from './calendar';
import { LogEntriesService } from '../../../../core/services/log-entries.service';

function createLogEntriesMock() {
  const overlayState = signal<{
    mode: 'quick' | 'edit';
    dateKey: string;
  } | null>(null);

  return {
    overlayState,
    latestEntry: signal(null),
    openEditLog: vi.fn((dateKey: string) => {
      overlayState.set({ mode: 'edit', dateKey });
    }),
    openQuickLog: vi.fn(),
    closeOverlay: vi.fn(),
    entryForDate: vi.fn((dateKey: string) =>
      dateKey === '2026-06-04'
        ? {
            dateKey: '2026-06-04',
            flowIntensity: 'medium',
            symptoms: ['cramps', 'headache'],
            mood: 'calm',
            sexualActivity: false,
            vaginalDischarge: true,
            notes: 'Sample entry.',
            createdAt: '2026-06-04T00:00:00.000Z',
            updatedAt: '2026-06-04T12:00:00.000Z',
          }
        : null,
    ),
  };
}

describe('Calendar', () => {
  it('renders day details for a selected date and opens the edit overlay', () => {
    const logEntriesMock = createLogEntriesMock();

    const fixture = TestBed.configureTestingModule({
      imports: [Calendar],
      providers: [{ provide: LogEntriesService, useValue: logEntriesMock }],
    }).createComponent(Calendar);

    fixture.componentInstance.selectedDateKey.set('2026-06-04');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.day-details-card')).not.toBeNull();
    expect(compiled.textContent).toContain('Thursday, June 4');
    expect(compiled.textContent).toContain('Medium');

    compiled.querySelector('.day-details-edit')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(logEntriesMock.openEditLog).toHaveBeenCalledWith('2026-06-04');
    expect(logEntriesMock.overlayState()).toEqual({
      mode: 'edit',
      dateKey: '2026-06-04',
    });
  });
});
