import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { computed, signal } from '@angular/core';
import { App } from './app';
import { routes } from './app.routes';
import { OnboardingPage } from './pages/onboarding-page/onboarding-page';
import { CycleSettingsService } from './core/services/cycle-settings.service';
import { LogEntriesService } from './core/services/log-entries.service';
import { HomePage } from './pages/home/home-page';
import { ProfilePage } from './pages/profile-page/profile-page';
import { CalendarPage } from './pages/calendar-page/calendar-page';

function createCycleSettingsMock(hasSettings: boolean) {
  const cycleSettings = signal(
    hasSettings
      ? {
          id: 'default' as const,
          cycleLength: 30,
          periodLength: 6,
          updatedAt: '2026-06-04T00:00:00.000Z',
        }
      : undefined,
  );

  return {
    hasSavedCycleSettings: vi.fn().mockResolvedValue(hasSettings),
    cycleSettings,
    resolvedSettings: computed(() => ({
      cycleLength: cycleSettings()?.cycleLength ?? 28,
      periodLength: cycleSettings()?.periodLength ?? 5,
    })),
    saveCycleSettings: vi.fn(async ({ cycleLength, periodLength }) => {
      cycleSettings.set({
        id: 'default',
        cycleLength,
        periodLength,
        updatedAt: '2026-06-04T00:00:00.000Z',
      });
    }),
  };
}

function createLogEntriesMock() {
  const overlayState = signal<{
    mode: 'quick' | 'edit';
    dateKey: string;
  } | null>(null);

  const logEntries = signal<
    Array<{
      dateKey: string;
      flowIntensity: 'none' | 'light' | 'medium' | 'heavy';
      symptoms: Array<'cramps' | 'headache' | 'bloating' | 'acne' | 'tender' | 'fatigue'>;
      mood: 'happy' | 'calm' | 'sensitive' | 'low' | 'irritated';
      sexualActivity: boolean;
      vaginalDischarge: boolean;
      notes: string;
      createdAt: string;
      updatedAt: string;
    }>
  >([
    {
      dateKey: '2026-06-04',
      flowIntensity: 'medium',
      symptoms: ['cramps', 'headache'],
      mood: 'calm',
      sexualActivity: false,
      vaginalDischarge: true,
      notes: 'Sample entry.',
      createdAt: '2026-06-04T00:00:00.000Z',
      updatedAt: '2026-06-04T12:00:00.000Z',
    },
  ]);

  return {
    overlayState,
    entries: logEntries,
    latestEntry: computed(() => logEntries()[0] ?? null),
    openQuickLog: vi.fn((dateKey = '2026-06-04') => {
      overlayState.set({ mode: 'quick', dateKey });
    }),
    openEditLog: vi.fn((dateKey: string) => {
      overlayState.set({ mode: 'edit', dateKey });
    }),
    closeOverlay: vi.fn(() => overlayState.set(null)),
    entryForDate: vi.fn(
      (dateKey: string) => logEntries().find((entry) => entry.dateKey === dateKey) ?? null,
    ),
    saveEntry: vi.fn(async () => undefined),
  };
}

describe('App', () => {
  async function setup(hasSettings: boolean) {
    const cycleSettingsMock = createCycleSettingsMock(hasSettings);
    const logEntriesMock = createLogEntriesMock();

    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [App, OnboardingPage, HomePage, CalendarPage, ProfilePage],
      providers: [
        provideRouter(routes),
        { provide: CycleSettingsService, useValue: cycleSettingsMock },
        { provide: LogEntriesService, useValue: logEntriesMock },
      ],
    }).compileComponents();

    return { cycleSettingsMock, logEntriesMock };
  }

  beforeEach(async () => {
    await setup(true);
  });

  it('should create the app shell', () => {
    const fixture = TestBed.createComponent(App);

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the router outlet shell host', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });

  it('should render the app navigation', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('app-navigation')).not.toBeNull();
    expect(compiled.textContent).toContain('Dashboard');
    expect(compiled.textContent).toContain('Calendar');
    expect(compiled.textContent).toContain('Profile');
  });

  it('should route first-time users to onboarding', async () => {
    await setup(false);

    const harness = await RouterTestingHarness.create('/');
    await harness.navigateByUrl('/', OnboardingPage);

    expect(harness.routeNativeElement?.querySelector('.onboarding-page')).not.toBeNull();
  });

  it('should render the shell and dashboard when settings already exist', async () => {
    await setup(true);

    const harness = await RouterTestingHarness.create('/');
    await harness.navigateByUrl('/home', HomePage);

    const route = harness.routeNativeElement as HTMLElement;

    expect(route.querySelector('.dashboard-page')).not.toBeNull();
    expect(route.querySelector('app-current-cycle-day-card')).not.toBeNull();
    expect(route.querySelector('app-days-until-next-period-card')).not.toBeNull();
  });

  it('should render the calendar route', async () => {
    await setup(true);

    const harness = await RouterTestingHarness.create('/');
    await harness.navigateByUrl('/calendar', CalendarPage);

    expect(harness.routeNativeElement?.querySelector('app-calendar')).not.toBeNull();
  });

  it('should render the profile route', async () => {
    await setup(true);

    const harness = await RouterTestingHarness.create('/');
    await harness.navigateByUrl('/profile', ProfilePage);

    expect(harness.routeNativeElement?.querySelector('.profile-page')).not.toBeNull();
  });

  it('should keep onboarding hidden once settings exist', async () => {
    await setup(true);

    const harness = await RouterTestingHarness.create('/');
    await harness.navigateByUrl('/onboarding', OnboardingPage);

    expect(harness.routeNativeElement?.querySelector('.dashboard-page')).not.toBeNull();
  });

  it('should open the quick log overlay from the dashboard', async () => {
    const { logEntriesMock } = await setup(true);

    const harness = await RouterTestingHarness.create('/');
    await harness.navigateByUrl('/home', HomePage);

    const route = harness.routeNativeElement as HTMLElement;
    (route.querySelector('.quick-log-card') as HTMLButtonElement | null)?.click();

    expect(logEntriesMock.openQuickLog).toHaveBeenCalledTimes(1);
    expect(logEntriesMock.overlayState()).toEqual({
      mode: 'quick',
      dateKey: '2026-06-04',
    });
  });
});
