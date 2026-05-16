import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';
import { HomePage } from './pages/home/home-page';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the router outlet shell', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });

  it('should render the home route', async () => {
    const harness = await RouterTestingHarness.create('/');
    const component = await harness.navigateByUrl('/', HomePage);

    expect(component).toBeTruthy();
    expect(harness.routeNativeElement?.querySelector('.calendar-card')).not.toBeNull();
  });
});

describe('HomePage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomePage],
    }).compileComponents();
  });

  it('should render the current month label', () => {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const heading = compiled.querySelector('.month-heading h2')?.textContent?.trim();
    expect(heading).toBeTruthy();
  });

  it('should render calendar day buttons', () => {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('.day-cell').length).toBe(42);
  });

  it('should select a day when clicked', () => {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const targetDay = component.calendarDays[10];
    const dayButtons = fixture.nativeElement.querySelectorAll('.day-cell');

    dayButtons[10].click();
    fixture.detectChanges();

    expect(component.selectedDateKey).toBe(targetDay.dateKey);
    expect(dayButtons[10].classList.contains('selected')).toBeTruthy();
  });

  it('should toggle a selected day on as a period day', () => {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const targetDay = component.calendarDays[12];
    const dayButtons = fixture.nativeElement.querySelectorAll('.day-cell');

    dayButtons[12].click();
    fixture.detectChanges();

    const toggleButton = fixture.nativeElement.querySelector('app-button') as HTMLButtonElement;
    toggleButton.click();
    fixture.detectChanges();

    expect(component.periodDates).toContain(targetDay.dateKey);
    expect(dayButtons[12].classList.contains('period-day')).toBeTruthy();
  });

  it('should toggle a selected day off as a period day', () => {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const targetDay = component.calendarDays[14];
    const dayButtons = fixture.nativeElement.querySelectorAll('.day-cell');

    dayButtons[14].click();
    fixture.detectChanges();

    const toggleButton = fixture.nativeElement.querySelector('app-button') as HTMLButtonElement;
    toggleButton.click();
    fixture.detectChanges();
    toggleButton.click();
    fixture.detectChanges();

    expect(component.periodDates).not.toContain(targetDay.dateKey);
    expect(dayButtons[14].classList.contains('period-day')).toBeFalsy();
  });

  it('should change the visible month', () => {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const initialMonth = component.displayedMonth.getMonth();
    const nextButton = fixture.nativeElement.querySelectorAll(
      '.nav-button',
    )[1] as HTMLButtonElement;

    nextButton.click();
    fixture.detectChanges();

    expect(component.displayedMonth.getMonth()).not.toBe(initialMonth);
  });
});
