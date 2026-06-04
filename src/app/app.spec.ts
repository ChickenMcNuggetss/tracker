import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';
import { CalendarPage } from './pages/calendar-page/calendar-page';
import { HomePage } from './pages/home/home-page';
import { LogsPage } from './pages/logs-page/logs-page';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('should create the app shell', () => {
    const fixture = TestBed.createComponent(App);

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the navigation and router outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('app-navigation')).not.toBeNull();
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
    expect(compiled.textContent).toContain('Dashboard');
    expect(compiled.textContent).toContain('Calendar');
    expect(compiled.textContent).toContain('Logs');
  });

  it('should redirect the root route to home', async () => {
    const harness = await RouterTestingHarness.create('/');
    await harness.navigateByUrl('/', HomePage);

    expect(harness.routeNativeElement?.querySelector('.dashboard-page')).not.toBeNull();
  });

  it('should render the home dashboard route', async () => {
    const harness = await RouterTestingHarness.create('/');
    await harness.navigateByUrl('/home', HomePage);

    const route = harness.routeNativeElement as HTMLElement;

    expect(route.querySelector('.dashboard-page')).not.toBeNull();
    expect(route.querySelector('app-current-cycle-day-card')).not.toBeNull();
    expect(route.querySelector('app-days-until-next-period-card')).not.toBeNull();
  });

  it('should render the calendar route', async () => {
    const harness = await RouterTestingHarness.create('/');
    await harness.navigateByUrl('/calendar', CalendarPage);

    expect(harness.routeNativeElement?.querySelector('app-calendar')).not.toBeNull();
  });

  it('should render the logs route', async () => {
    const harness = await RouterTestingHarness.create('/');
    await harness.navigateByUrl('/logs', LogsPage);

    expect(harness.routeNativeElement?.querySelector('.logs-page')).not.toBeNull();
  });
});
