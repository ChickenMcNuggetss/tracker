import { DOCUMENT } from '@angular/common';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LogEntriesService } from '../../../core/services/log-entries.service';
import { LogOverlayComponent } from './log-overlay.component';

describe('LogOverlayComponent', () => {
  it('syncs the form values when the overlay state points to an existing entry', () => {
    const overlayState = signal<{
      mode: 'quick' | 'edit';
      dateKey: string;
    } | null>(null);

    const entry = {
      dateKey: '2026-06-04',
      flowIntensity: 'medium' as const,
      symptoms: ['cramps' as const],
      mood: 'calm' as const,
      sexualActivity: false,
      vaginalDischarge: true,
      notes: 'Sample entry.',
      createdAt: '2026-06-04T00:00:00.000Z',
      updatedAt: '2026-06-04T12:00:00.000Z',
    };

    const logEntriesService = {
      overlayState,
      entryForDate: vi.fn((dateKey: string) => (dateKey === entry.dateKey ? entry : null)),
      closeOverlay: vi.fn(),
      saveEntry: vi.fn(async () => undefined),
    };

    TestBed.resetTestingModule();

    TestBed.configureTestingModule({
      imports: [LogOverlayComponent],
      providers: [
        { provide: LogEntriesService, useValue: logEntriesService },
        { provide: DOCUMENT, useValue: document },
      ],
    });

    const fixture = TestBed.createComponent(LogOverlayComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.form.controls.flowIntensity.value).toBe('none');

    overlayState.set({ mode: 'edit', dateKey: '2026-06-04' });
    fixture.detectChanges();

    expect(fixture.componentInstance.form.controls.flowIntensity.value).toBe('medium');
    expect(fixture.componentInstance.form.controls.notes.value).toBe('Sample entry.');
  });
});
