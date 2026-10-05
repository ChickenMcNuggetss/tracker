# Cycle Tracker — Project Plan

> Privacy-first, local-first menstrual cycle tracking PWA
> Angular 20+ · Signals · Dexie.js · Custom SCSS + CDK · i18n-ready

---

## Table of Contents

- [Architecture Decisions](#architecture-decisions)
- [Folder Structure](#folder-structure)
- [Data Flow](#data-flow)
- [Phases & Tickets](#phases--tickets)
  - [Phase 1: Foundation](#phase-1-foundation)
  - [Phase 2: Domain Logic](#phase-2-domain-logic)
  - [Phase 3: State & Shell](#phase-3-state--shell)
  - [Phase 4: Features](#phase-4-features)
  - [Phase 5: Notifications](#phase-5-notifications)
  - [Phase 6: Polish & Ship](#phase-6-polish--ship)
- [Verification Criteria](#verification-criteria)

---

## Architecture Decisions

| #      | Decision           | Choice                                             | Alternatives Considered                                     | Rationale                                                                                                                                                         |
| ------ | ------------------ | -------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR-1  | State Management   | **Angular Signals (service-based)**                | NgRx, NgRx Signals, RxJS BehaviorSubjects                   | ~3 entities, simple flows. Signals are native, reactive, zero boilerplate. NgRx adds complexity without value at this scale.                                      |
| ADR-2  | Local Storage      | **Dexie.js (IndexedDB)**                           | Raw IndexedDB, localForage, RxDB                            | Dexie provides typed queries, schema versioning, excellent DX. ~15KB cost is negligible. RxDB is overkill without sync.                                           |
| ADR-3  | Calendar Component | **Custom + Angular CDK**                           | FullCalendar, Angular Material Datepicker, PrimeNG Calendar | No library handles multi-day period/ovulation range markers well. CDK provides a11y primitives (focus trap, keyboard nav, live announcer).                        |
| ADR-4  | UI Components      | **Custom SCSS + Angular CDK**                      | Angular Material, Taiga UI, PrimeNG                         | Full design control, smaller bundle (~0KB lib overhead), matches privacy-minimal brand. CDK for overlays, a11y, layout.                                           |
| ADR-5  | i18n               | **`ngx-translate` (runtime)**                      | @angular/localize (compile-time), Transloco (runtime)       | Simple JSON files, one build for all locales, instant language switching. Negligible perf cost for <500 strings. Easier DX than XLF/XLIFF extraction pipeline.    |
| ADR-6  | Date Utilities     | **date-fns v3+**                                   | Temporal API, Luxon, Day.js                                 | Tree-shakable (~3KB used), immutable, locale-aware. Temporal API browser support still incomplete in 2026.                                                        |
| ADR-7  | SSR                | **None**                                           | Angular Universal                                           | Local-first app with no SEO needs. Service Worker caches the shell. SSR adds complexity with zero benefit.                                                        |
| ADR-8  | Testing            | **Vitest (domain logic only for MVP)**             | Jest, Karma, full coverage                                  | Default test runner in Angular 19+. Zero-config with CLI, native ESM, faster execution. Prediction engine correctness is critical; UI tests deferred to post-MVP. |
| ADR-9  | Notifications      | **Web Push + in-app fallback**                     | Native-only (Capacitor), no notifications                   | Progressive: in-app banner always works, Web Push as opt-in enhancement. iOS PWA push limited but improving.                                                      |
| ADR-10 | Date Storage       | **ISO date strings (`YYYY-MM-DD`)**                | Unix timestamps, JS Date objects                            | No time component = no timezone bugs. Human-readable in DB. Easy JSON export.                                                                                     |
| ADR-11 | ID Generation      | **`crypto.randomUUID()`**                          | uuid package, auto-increment                                | Native, no dependency, globally unique. Supported in all modern browsers.                                                                                         |
| ADR-12 | Dark Mode          | **CSS custom properties + `prefers-color-scheme`** | Separate theme files, Material theming                      | Trivial to implement with variables. System-preference detection is zero-config UX.                                                                               |
| ADR-13 | PWA Strategy       | **`@angular/service-worker`**                      | Workbox, custom SW                                          | Official, well-integrated with Angular CLI, automatic precaching manifest.                                                                                        |

---

## Folder Structure

```
cycle-tracker/
├── angular.json
├── package.json
├── tsconfig.json
├── ngsw-config.json                    # Service Worker config
├── vitest.config.ts
│
├── src/
│   ├── index.html
│   ├── main.ts
│   ├── styles.scss                     # Global styles, CSS custom properties
│   ├── manifest.webmanifest            # PWA manifest
│   │
│   ├── app/
│   │   ├── app.component.ts
│   │   ├── app.component.scss
│   │   ├── app.config.ts              # provideRouter, provideServiceWorker, etc.
│   │   ├── app.routes.ts              # Top-level routes (lazy-loaded features)
│   │   │
│   │   ├── core/                      # Singleton services, app-wide infrastructure
│   │   │   ├── services/
│   │   │   │   ├── storage.service.ts          # Dexie DB instance & schema
│   │   │   │   ├── notification.service.ts     # Web Push + in-app scheduling
│   │   │   │   └── platform.service.ts         # PWA detection, install prompt
│   │   │   │
│   │   │   └── repositories/
│   │   │       ├── cycle.repository.ts         # CRUD for cycles (Dexie)
│   │   │       └── settings.repository.ts      # Read/write settings (Dexie)
│   │   │
│   │   ├── domain/                    # Pure business logic (NO Angular dependencies)
│   │   │   ├── models/
│   │   │   │   ├── cycle.model.ts              # ICycle interface
│   │   │   │   ├── prediction.model.ts         # IPrediction interface
│   │   │   │   └── settings.model.ts           # ISettings interface
│   │   │   │
│   │   │   ├── prediction/
│   │   │   │   ├── prediction.engine.ts        # calculate(cycles, settings) → IPrediction
│   │   │   │   ├── prediction.engine.spec.ts
│   │   │   │   ├── confidence.calculator.ts    # Std deviation → confidence level
│   │   │   │   └── confidence.calculator.spec.ts
│   │   │   │
│   │   │   ├── validation/
│   │   │   │   ├── cycle.validator.ts          # Overlap, range, future-date checks
│   │   │   │   └── cycle.validator.spec.ts
│   │   │   │
│   │   │   └── statistics/
│   │   │       ├── cycle-stats.calculator.ts   # Averages, regularity
│   │   │       └── cycle-stats.calculator.spec.ts
│   │   │
│   │   ├── state/                     # Signal-based reactive state
│   │   │   ├── cycles.state.ts                 # signal<ICycle[]>, CRUD methods
│   │   │   ├── predictions.state.ts            # computed from cycles
│   │   │   └── settings.state.ts               # signal<ISettings>
│   │   │
│   │   ├── features/                  # Lazy-loaded route-level features
│   │   │   ├── calendar/
│   │   │   │   ├── calendar.component.ts
│   │   │   │   ├── calendar.component.scss
│   │   │   │   ├── calendar-grid.component.ts
│   │   │   │   ├── calendar-day.component.ts
│   │   │   │   ├── calendar-legend.component.ts
│   │   │   │   └── calendar.routes.ts
│   │   │   │
│   │   │   ├── cycle-log/
│   │   │   │   ├── log-cycle.component.ts      # "Start/End Period" flow
│   │   │   │   ├── log-cycle.component.scss
│   │   │   │   ├── edit-cycle.component.ts     # Edit existing cycle (bottom sheet)
│   │   │   │   └── cycle-log.routes.ts
│   │   │   │
│   │   │   ├── insights/
│   │   │   │   ├── insights.component.ts
│   │   │   │   ├── insights.component.scss
│   │   │   │   ├── stats-card.component.ts
│   │   │   │   ├── countdown.component.ts      # Days until next period
│   │   │   │   └── insights.routes.ts
│   │   │   │
│   │   │   ├── settings/
│   │   │   │   ├── settings.component.ts
│   │   │   │   ├── settings.component.scss
│   │   │   │   ├── data-management.component.ts  # Export/delete
│   │   │   │   └── settings.routes.ts
│   │   │   │
│   │   │   └── onboarding/
│   │   │       ├── onboarding.component.ts     # Container (stepper)
│   │   │       ├── onboarding.component.scss
│   │   │       ├── steps/
│   │   │       │   ├── welcome-step.component.ts
│   │   │       │   ├── last-period-step.component.ts
│   │   │       │   └── cycle-length-step.component.ts
│   │   │       └── onboarding.routes.ts
│   │   │
│   │   └── shared/                    # Reusable UI building blocks
│   │       ├── components/
│   │       │   ├── date-picker/
│   │       │   │   ├── date-picker.component.ts
│   │       │   │   └── date-picker.component.scss
│   │       │   ├── bottom-sheet/
│   │       │   │   ├── bottom-sheet.component.ts
│   │       │   │   └── bottom-sheet.component.scss
│   │       │   ├── badge/
│   │       │   │   └── badge.component.ts
│   │       │   ├── bottom-nav/
│   │       │   │   ├── bottom-nav.component.ts
│   │       │   │   └── bottom-nav.component.scss
│   │       │   ├── reminder-banner/
│   │       │   │   ├── reminder-banner.component.ts
│   │       │   │   └── reminder-banner.component.scss
│   │       │   ├── confirm-dialog/
│   │       │   │   └── confirm-dialog.component.ts
│   │       │   └── fab-button/
│   │       │       ├── fab-button.component.ts
│   │       │       └── fab-button.component.scss
│   │       │
│   │       ├── pipes/
│   │       │   ├── relative-date.pipe.ts       # "in 3 days", "2 days ago"
│   │       │   └── date-format.pipe.ts         # Locale-aware formatting
│   │       │
│   │       └── directives/
│   │           └── swipe.directive.ts          # Horizontal swipe for calendar nav
│   │
│   ├── assets/
│   │   ├── icons/                     # PWA icons (192, 512)
│   │   └── i18n/
│   │       ├── en.json                # English translations
│   │       └── ...                    # Additional locale JSON files
│   │
│   └── theme/
│       ├── _variables.scss            # CSS custom properties (colors, spacing, radii)
│       ├── _typography.scss           # Font scale, weights
│       ├── _dark-mode.scss            # Dark theme overrides
│       └── _mixins.scss               # Responsive breakpoints, a11y helpers
```

---

## Data Flow

### Cycle Logging (Primary Flow)

```
┌─────────────────┐
│   User Action   │  (tap "Start Period" / edit date)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ CycleValidator  │  validate(input)
│                 │  • No overlap with existing cycles
│                 │  • startDate ≤ today
│                 │  • endDate ≥ startDate (if provided)
│                 │  • Period duration 1–14 days (warn >10)
└────────┬────────┘
         │ valid
         ▼
┌─────────────────┐
│CycleRepository  │  save(cycle) → IndexedDB via Dexie
│                 │  • Upsert: create or update by ID
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  CyclesState    │  reload() → signal<ICycle[]> updated
│  (Angular       │
│   Signal)       │
└────────┬────────┘
         │ triggers computed()
         ▼
┌─────────────────────────────────┐
│       PredictionEngine          │  calculate(cycles, settings)
│  (pure function, no Angular)    │  → IPrediction
│                                 │  • Average cycle length
│                                 │  • Next period start/end
│                                 │  • Ovulation window
│                                 │  • Confidence score
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────┐
│PredictionsState │  signal<IPrediction> updated
└────────┬────────┘
         │
    ┌────┴─────────────────────┐
    │                          │
    ▼                          ▼
┌────────────┐      ┌──────────────────┐
│  UI Update │      │NotificationService│
│ (reactive) │      │ reschedule()     │
│ • Calendar │      │ • Cancel old     │
│ • Insights │      │ • Schedule new   │
│ • Banner   │      │ • In-app flag    │
└────────────┘      └──────────────────┘
```

### App Startup Flow

```
App Bootstrap
    │
    ▼
StorageService.init()          → Open Dexie DB, run migrations
    │
    ├──► SettingsRepository.load() → SettingsState.init(settings)
    │
    └──► CycleRepository.getAll() → CyclesState.init(cycles)
                                         │
                                         ▼
                                    PredictionEngine.calculate()
                                         │
                                         ▼
                                    PredictionsState.init(prediction)
                                         │
                                    ┌────┴────┐
                                    │         │
                                    ▼         ▼
                             Render UI   Schedule Notifications
```

### Notification Flow

```
PredictionsState updated
    │
    ▼
NotificationService.reschedule(prediction, settings)
    │
    ├── if (!settings.notificationsEnabled) → clear all, return
    │
    ├── Calculate trigger dates:
    │     • periodReminder = prediction.nextPeriodStart - settings.reminderDaysBefore
    │     • ovulationReminder = prediction.ovulationWindowStart
    │
    ├── if (Notification.permission === 'granted')
    │     └── Register with Service Worker (showNotification at trigger time)
    │
    └── Always: set inAppReminderState signal (for banner component)
```

---

## Phases & Tickets

### Phase 1: Foundation

> **Goal:** Scaffold the project, configure tooling, establish data layer.
> **Blocks:** All other phases.

| Ticket | Title                                | Description                                                                                                                                                                                                                                                                                                                                                  | Acceptance Criteria                                                                                                        |
| ------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| CT-001 | **Scaffold Angular project**         | `ng new cycle-tracker --style=scss --routing --ssr=false`. Configure `tsconfig` strict mode, path aliases (`@core/*`, `@domain/*`, `@state/*`, `@features/*`, `@shared/*`).                                                                                                                                                                                  | Project builds with `ng build`. Strict mode enabled. Path aliases resolve.                                                 |
| CT-002 | **Add PWA support**                  | `ng add @angular/pwa`. Configure `ngsw-config.json` for precaching app shell, styles, and assets. Add `manifest.webmanifest` with app name, icons, theme color.                                                                                                                                                                                              | `ng build` produces `ngsw-worker.js`. Manifest is valid (Chrome DevTools audit). App installable on Android Chrome.        |
| CT-003 | **Install dependencies**             | Add: `dexie` (IndexedDB), `date-fns` (dates), `@angular/cdk` (a11y, overlays, layout), `@ngx-translate/core`, `@ngx-translate/http-loader`. Vitest is already included via Angular CLI scaffolding.                                                                                                                                                          | `npm install` succeeds. No peer dependency conflicts.                                                                      |
| CT-004 | **Configure Vitest**                 | Verify Angular CLI-scaffolded Vitest config (`vitest.config.ts`). Ensure `@angular/core/testing` works in Vitest environment. Add any path alias resolution. Verify with dummy test.                                                                                                                                                                         | `npm test` runs and passes a trivial spec. Vitest watch mode works (`npm run test:watch`).                                 |
| CT-005 | **Set up global SCSS theming**       | Create `src/theme/` with `_variables.scss` (CSS custom properties for colors, spacing, radii, shadows), `_typography.scss` (font scale), `_dark-mode.scss` (`prefers-color-scheme: dark` overrides), `_mixins.scss` (responsive breakpoints). Import in `styles.scss`.                                                                                       | App renders with custom properties. Dark mode toggles with system preference.                                              |
| CT-006 | **Configure i18n (ngx-translate)**   | In `app.config.ts`: add `provideHttpClient()` and `provideTranslateService({ loader: provideTranslateHttpLoader({ prefix: '/assets/i18n/', suffix: '.json' }), fallbackLang: 'en', lang: 'en' })`. Create `src/assets/i18n/en.json` with initial keys. In components: import `TranslatePipe`/`TranslateDirective`, inject `TranslateService` via `inject()`. | App loads English translations at runtime. `TranslatePipe` renders strings. Language switchable via `translate.use('xx')`. |
| CT-007 | **Implement StorageService (Dexie)** | Create `core/services/storage.service.ts`. Define Dexie database with tables: `cycles` (id, startDate, endDate, createdAt, updatedAt), `settings` (singleton row). Schema version 1.                                                                                                                                                                         | Service injectable. DB opens without errors. Tables exist in IndexedDB (DevTools).                                         |
| CT-008 | **Define domain models**             | Create `domain/models/cycle.model.ts` (`ICycle`), `prediction.model.ts` (`IPrediction`, `Confidence` type), `settings.model.ts` (`ISettings`). All pure TypeScript interfaces, no Angular imports.                                                                                                                                                           | Interfaces compile. No circular dependencies.                                                                              |
| CT-009 | **Implement CycleRepository**        | Create `core/repositories/cycle.repository.ts`. Methods: `getAll()`, `getById(id)`, `save(cycle)`, `delete(id)`, `deleteAll()`. Uses StorageService internally.                                                                                                                                                                                              | All CRUD operations work against IndexedDB. Data persists across page reloads.                                             |
| CT-010 | **Implement SettingsRepository**     | Create `core/repositories/settings.repository.ts`. Methods: `get()`, `save(settings)`. Returns defaults if no settings saved. Default: `{ notificationsEnabled: false, reminderDaysBefore: 2, ovulationReminderEnabled: true, defaultCycleLength: 28, locale: 'en' }`.                                                                                       | Settings persist. Defaults returned on fresh install.                                                                      |

---

### Phase 2: Domain Logic

> **Goal:** Implement all pure business logic. Fully unit-tested.
> **Parallel with:** Phase 3.
> **Depends on:** CT-008 (models).

| Ticket | Title                              | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Acceptance Criteria                                                                   |
| ------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| CT-011 | **Implement PredictionEngine**     | Create `domain/prediction/prediction.engine.ts`. Pure function: `calculate(cycles: ICycle[], settings: ISettings): IPrediction`. Logic: (1) If 0 cycles → use `settings.defaultCycleLength`, confidence='low'. (2) If 1 cycle → use default + last period data, confidence='low'. (3) If 2+ → average start-to-start, confidence based on consistency. Ovulation = nextPeriodStart − 14 days (±2 day window). Period end estimate = start + average period length. | Function returns correct predictions for all cases. No Angular imports.               |
| CT-012 | **Implement ConfidenceCalculator** | Create `domain/prediction/confidence.calculator.ts`. Input: cycle lengths array. Output: `'low'                                                                                                                                                                                                                                                                                                                                                                    | 'medium'                                                                              | 'high'`. Rules: `low`if <3 cycles OR stddev >5 days.`medium`if 3–5 cycles AND stddev 3–5 days.`high` if 6+ cycles AND stddev <3 days. | Correctly classifies: [28,28,28,28,28,28] → high. [28,35,22] → low. [28,30,27,29,28] → medium. |
| CT-013 | **Implement CycleValidator**       | Create `domain/validation/cycle.validator.ts`. Validates: (1) startDate not in future. (2) endDate ≥ startDate if present. (3) Period duration ≤ 14 days (warning if >10). (4) No overlap with existing cycles (pass existing cycles as param). Returns `{ valid: boolean, errors: string[], warnings: string[] }`.                                                                                                                                                | Rejects overlapping cycles. Warns on long periods. Rejects future start dates.        |
| CT-014 | **Implement CycleStatsCalculator** | Create `domain/statistics/cycle-stats.calculator.ts`. Functions: `averageCycleLength(cycles)`, `averagePeriodLength(cycles)`, `lastCycleLength(cycles)`, `isRegular(cycles): boolean` (regular if stddev < 3 days with 3+ data points).                                                                                                                                                                                                                            | Correctly calculates averages. `isRegular` handles edge cases (0 or 1 cycle → false). |
| CT-015 | **Unit tests: PredictionEngine**   | Test cases: (1) 0 cycles returns default-based prediction. (2) 1 cycle uses defaults. (3) 3 regular cycles → high accuracy. (4) Irregular cycles → wide ovulation window estimate. (5) Very short/long cycles handled gracefully. (6) Ovulation window is always before predicted period.                                                                                                                                                                          | All tests pass. 100% branch coverage on prediction engine.                            |
| CT-016 | **Unit tests: Validator + Stats**  | Test CycleValidator: overlap detection, boundary dates, future dates. Test CycleStatsCalculator: empty array, single cycle, regular vs irregular sets.                                                                                                                                                                                                                                                                                                             | All tests pass. Edge cases covered.                                                   |

---

### Phase 3: State & Shell

> **Goal:** Wire up signal-based state, build app shell and shared components.
> **Parallel with:** Phase 2.
> **Depends on:** CT-007, CT-008, CT-009, CT-010.

| Ticket | Title                           | Description                                                                                                                                                                                                                                                            | Acceptance Criteria                                                                                     |
| ------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| CT-017 | **Implement CyclesState**       | Create `state/cycles.state.ts`. Signal service (`providedIn: 'root'`). Holds `signal<ICycle[]>`. Methods: `loadAll()` (from repo), `addCycle(cycle)`, `updateCycle(cycle)`, `removeCycle(id)`, `removeAll()`. Each method persists via repository then updates signal. | Signal updates reactively. Data round-trips through IndexedDB.                                          |
| CT-018 | **Implement PredictionsState**  | Create `state/predictions.state.ts`. Uses `computed()` from `CyclesState.cycles` + `SettingsState.settings` → runs `PredictionEngine.calculate()`. Exposes `prediction: Signal<IPrediction \| null>`.                                                                  | Prediction recomputes when cycles or settings change. Null when no cycles.                              |
| CT-019 | **Implement SettingsState**     | Create `state/settings.state.ts`. Signal service. Holds `signal<ISettings>`. Methods: `load()`, `update(partial: Partial<ISettings>)`. Persists via SettingsRepository.                                                                                                | Settings persist and signal updates on change.                                                          |
| CT-020 | **App shell & routing**         | Create `app.component.ts` with `<router-outlet>` + bottom navigation. Configure lazy routes: `/calendar` (default), `/log`, `/insights`, `/settings`, `/onboarding`. Add route guard: redirect to `/onboarding` if no settings exist (first launch).                   | Navigation works. Lazy chunks load correctly. First-time user sees onboarding.                          |
| CT-021 | **Bottom navigation component** | Create `shared/components/bottom-nav/`. Four tabs: Calendar, Log, Insights, Settings. Active state indicator. Mobile-optimized (56px height, touch targets ≥ 48px). Icons (inline SVG or Unicode).                                                                     | Tabs navigate between routes. Active tab highlighted. Accessible (role="navigation", aria-current).     |
| CT-022 | **Date picker component**       | Create `shared/components/date-picker/`. Uses CDK overlay. Month view with selectable days. Constrained to past dates (for cycle logging). Outputs selected date as ISO string. Keyboard accessible.                                                                   | Opens as overlay. Selects dates. Emits value. Closes on selection or outside click. Keyboard navigable. |
| CT-023 | **Reminder banner component**   | Create `shared/components/reminder-banner/`. Input: `prediction` signal. Shows when next period is ≤ `reminderDaysBefore` days away. Dismissible (per-session). Accessible (role="alert").                                                                             | Shows at correct timing. Dismisses. Reappears next session.                                             |
| CT-024 | **FAB button component**        | Create `shared/components/fab-button/`. Floating action button, bottom-right, 56px diameter. Emits click. Customizable icon.                                                                                                                                           | Renders fixed-position. Click emits. Accessible (aria-label).                                           |
| CT-025 | **Bottom sheet component**      | Create `shared/components/bottom-sheet/`. CDK overlay from bottom. Drag-to-dismiss. Backdrop. Content projection.                                                                                                                                                      | Opens from bottom. Closes on backdrop click or drag down. Focus trapped.                                |
| CT-026 | **Confirm dialog component**    | Create `shared/components/confirm-dialog/`. CDK dialog. Title, message, confirm/cancel buttons. Returns boolean.                                                                                                                                                       | Opens centered. Returns true/false. Focus trapped. Escape closes.                                       |

---

### Phase 4: Features

> **Goal:** Build all user-facing feature screens.
> **Depends on:** Phase 2 + Phase 3.

| Ticket | Title                                    | Description                                                                                                                                                                                                             | Acceptance Criteria                                                                                   |
| ------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| CT-027 | **Onboarding: Welcome step**             | First screen of onboarding. App name, brief tagline ("Track your cycle privately, on your device"), illustration/icon, "Get Started" button. Disclaimer: "This app provides estimates, not medical advice."             | Screen renders. Button advances to next step.                                                         |
| CT-028 | **Onboarding: Last period step**         | Second screen. "When did your last period start?" Date picker (defaults to today). Required field. "Next" button.                                                                                                       | Date selectable. Cannot proceed without date. Stores value in onboarding state.                       |
| CT-029 | **Onboarding: Cycle length step**        | Third screen. "How long is your typical cycle? (optional)" Number input (18–45 days), default 28 shown as placeholder. "Skip" and "Done" buttons. On completion: save settings, save first cycle, navigate to calendar. | Optional input validates range. Skip uses 28. Done triggers first prediction.                         |
| CT-030 | **Calendar: Month grid view**            | Main calendar feature. Displays current month in grid (7 cols × 5–6 rows). Header with month/year and prev/next arrows. Days show visual markers. Today highlighted.                                                    | Month renders correctly. Navigation changes month. Today has distinct style.                          |
| CT-031 | **Calendar: Period & ovulation markers** | Color-code days: (1) Actual period days — solid primary color. (2) Predicted period — hatched/striped primary. (3) Ovulation window — secondary color dot/ring. (4) Today — border accent. Add legend below calendar.   | Visual differentiation clear. Legend matches markers. Accessible (not color-only: patterns + labels). |
| CT-032 | **Calendar: Cycle detail on tap**        | Tapping a day that belongs to a cycle opens bottom sheet with: cycle start/end dates, cycle length, "Edit" and "Delete" buttons. Tapping predicted days shows prediction info + confidence badge.                       | Sheet opens with correct data. Edit navigates to edit flow. Delete shows confirmation.                |
| CT-033 | **Calendar: Swipe navigation**           | Horizontal swipe (touch) or arrow keys (keyboard) to navigate months. Use `shared/directives/swipe.directive.ts`. Debounced.                                                                                            | Swipe left → next month. Swipe right → prev month. Keyboard arrows work.                              |
| CT-034 | **Cycle log: Start period**              | FAB on calendar view → opens log flow. "Period started today" (primary action, 1 tap). "Choose different date" → date picker. Validates via CycleValidator. On save: CyclesState.addCycle(), close, show success.       | Logging in ≤ 2 taps for today. Date picker for past dates. Validation errors shown.                   |
| CT-035 | **Cycle log: End period**                | If active period (no endDate), show "End Period" option. Tap → sets endDate to today or pick date. Validates endDate ≥ startDate.                                                                                       | Active period detected. End date saved. Prediction recalculates.                                      |
| CT-036 | **Cycle log: Edit cycle**                | From calendar detail sheet → "Edit". Opens form with startDate + endDate (both editable via date picker). Save validates, updates via CyclesState.updateCycle().                                                        | Both dates editable. Validation applied. Prediction updates on save.                                  |
| CT-037 | **Cycle log: Delete cycle**              | From calendar detail sheet → "Delete". Confirm dialog: "Delete this cycle? This cannot be undone." On confirm: CyclesState.removeCycle(id).                                                                             | Confirmation required. Cycle removed. Calendar and predictions update.                                |
| CT-038 | **Insights: Statistics display**         | Insights page shows cards: (1) Average cycle length (days). (2) Average period length (days). (3) Last cycle length. (4) Next period countdown ("in X days" or "today" or "X days late").                               | All stats calculated from CycleStatsCalculator. Handles 0 data gracefully ("Not enough data").        |
| CT-039 | **Insights: Regularity indicator**       | Badge/card showing "Regular" (green) or "Irregular" (amber) or "Not enough data" (grey). Based on `CycleStatsCalculator.isRegular()`. Tooltip/info icon explaining criteria.                                            | Correctly reflects cycle regularity. Info accessible.                                                 |
| CT-040 | **Insights: Prediction confidence**      | Display current prediction confidence (Low/Medium/High) with visual indicator (icon + color). Brief explanation of what improves confidence ("Log more cycles for better predictions").                                 | Confidence badge renders. Explanation visible.                                                        |
| CT-041 | **Settings: Notification preferences**   | Toggle: Enable/disable notifications. Number input: Remind X days before (1–7, default 2). Toggle: Ovulation reminder on/off. Request notification permission on enable (if not already granted).                       | Toggles persist. Permission requested. Settings saved to SettingsState.                               |
| CT-042 | **Settings: Data export**                | "Export Data" button → generates JSON file with all cycles and settings. Downloads via blob URL. Format: `{ version: 1, exportedAt: ISO, cycles: [...], settings: {...} }`.                                             | File downloads. JSON valid. Contains all user data.                                                   |
| CT-043 | **Settings: Delete all data**            | "Delete All Data" button → confirm dialog with strong warning ("This will permanently delete all your cycle data. This cannot be undone."). On confirm: clear IndexedDB tables, reset state, redirect to onboarding.    | Confirmation required (must type "DELETE" or double-confirm). All data gone. App restarts as fresh.   |
| CT-044 | **Settings: About & disclaimer**         | Section with: app version, medical disclaimer text, privacy statement ("All data stored locally on your device. No data is sent to any server."), link to source (if open source).                                      | Text renders. No external calls made.                                                                 |

---

### Phase 5: Notifications

> **Goal:** Implement notification scheduling with graceful degradation.
> **Depends on:** Phase 4 (predictions must be working).

| Ticket | Title                                  | Description                                                                                                                                                                                                                                                           | Acceptance Criteria                                                                                  |
| ------ | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| CT-045 | **NotificationService: Core**          | Create `core/services/notification.service.ts`. Methods: `requestPermission()`, `isSupported()`, `getPermissionStatus()`, `scheduleNotification(date, title, body)`, `cancelAll()`. Uses `Notification` API + Service Worker registration.                            | Permission request works. Status correctly reported. Schedule/cancel functions operational.          |
| CT-046 | **Notification: Period reminder**      | When prediction updates AND notifications enabled: schedule notification for `nextPeriodStart - reminderDaysBefore`. Title: "Period Expected Soon". Body: "Your period is predicted to start in {X} days." Cancel previous period reminder before scheduling new one. | Notification fires at correct time (testable with short interval). Reschedules on prediction change. |
| CT-047 | **Notification: Ovulation reminder**   | If ovulation reminder enabled: schedule for `ovulationWindowStart`. Title: "Fertile Window Starting". Body: "Your estimated fertile window begins today."                                                                                                             | Notification fires. Disabled if toggle off.                                                          |
| CT-048 | **Service Worker: Notification click** | Handle `notificationclick` in SW: open app to calendar view (or focus existing window). Close notification.                                                                                                                                                           | Click opens app. If already open, focuses. Notification dismissed.                                   |
| CT-049 | **In-app reminder integration**        | Connect `ReminderBanner` component to `PredictionsState`. Show banner on calendar page when period is ≤ `reminderDaysBefore` away. Works regardless of push notification permission.                                                                                  | Banner appears at correct time. Works in airplane mode. Dismissible per session.                     |

---

### Phase 6: Polish & Ship

> **Goal:** Accessibility, responsive design, PWA install UX, final QA.
> **Depends on:** All previous phases.

| Ticket | Title                           | Description                                                                                                                                                                                                                                                                                                  | Acceptance Criteria                                                                                 |
| ------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| CT-050 | **Accessibility audit & fixes** | Full WCAG 2.1 AA pass: (1) All interactive elements keyboard-accessible. (2) Focus indicators visible. (3) Color contrast ≥ 4.5:1. (4) Calendar markers not color-only (add patterns/text). (5) ARIA labels on all controls. (6) Screen reader announces predictions, reminders. (7) Reduced motion support. | Lighthouse Accessibility ≥ 90. Manual screen reader test passes (NVDA or VoiceOver).                |
| CT-051 | **Responsive design**           | Mobile-first (320px–428px). Tablet (768px): 2-column insights. Desktop (1024px+): centered max-width container (480px). Touch targets ≥ 48px. No horizontal scroll.                                                                                                                                          | Renders correctly at all breakpoints. No overflow. Touch targets sized properly.                    |
| CT-052 | **PWA install prompt**          | Create `core/services/platform.service.ts`. Capture `beforeinstallprompt` event. Show custom install banner after 2nd visit (store visit count in localStorage). "Install App" button triggers native prompt. Dismiss hides for 7 days.                                                                      | Banner appears after 2nd visit. Install triggers native flow. Dismissal persists.                   |
| CT-053 | **Offline verification**        | Test all features with network disabled in DevTools: logging cycles, viewing calendar, editing, predictions, insights, settings. Verify no console errors. Verify SW serves cached shell.                                                                                                                    | All features work offline. No network requests made for core functionality.                         |
| CT-054 | **Performance optimization**    | Verify: (1) Initial bundle < 200KB (gzipped). (2) Lazy chunks load on navigation. (3) First Contentful Paint < 1.5s. (4) Total Blocking Time < 200ms. Tree-shake unused date-fns. Remove dead code.                                                                                                          | Lighthouse Performance ≥ 90. Bundle budget met.                                                     |
| CT-055 | **iOS Safari PWA testing**      | Test on iOS Safari: (1) "Add to Home Screen" works. (2) App opens in standalone mode. (3) IndexedDB persists. (4) Notifications (if iOS 16.4+ and installed). (5) No 100vh viewport bug. Document any iOS-specific workarounds applied.                                                                      | App installable and functional on iOS. Data persists across launches. Known limitations documented. |
| CT-056 | **Final QA & edge cases**       | Test: (1) Fresh install → onboarding → first prediction. (2) 10+ cycles logged → predictions accurate. (3) Delete all → clean restart. (4) Export → valid JSON. (5) Browser back/forward navigation. (6) Very old dates (years ago). (7) Rapid tapping (debounce).                                           | All flows work end-to-end. No crashes or data loss.                                                 |

---

## Verification Criteria

| #    | Criterion                      | Method                                                                            |
| ---- | ------------------------------ | --------------------------------------------------------------------------------- |
| V-1  | Production build succeeds      | `ng build --configuration=production` — zero errors                               |
| V-2  | Initial bundle < 200KB gzipped | Check `dist/` output or Lighthouse                                                |
| V-3  | Domain logic tests pass        | `npm test` — all specs green                                                      |
| V-4  | Prediction edge cases handled  | Unit tests cover: 0 cycles, 1 cycle, irregular, very short (18d), very long (45d) |
| V-5  | Lighthouse PWA ≥ 90            | Chrome DevTools Lighthouse audit                                                  |
| V-6  | Lighthouse Accessibility ≥ 90  | Chrome DevTools Lighthouse audit                                                  |
| V-7  | Lighthouse Performance ≥ 90    | Chrome DevTools Lighthouse audit                                                  |
| V-8  | Full offline functionality     | Disable network → all features work                                               |
| V-9  | Data persistence               | Log cycle → close browser → reopen → data present                                 |
| V-10 | iOS Safari compatible          | Add to Home Screen → app works, data persists                                     |
| V-11 | i18n works                     | App loads `en.json` translations, `translate` pipe renders correctly              |
| V-12 | Dark mode works                | System preference toggles theme correctly                                         |
| V-13 | No console errors              | Clean console in production mode                                                  |
| V-14 | Medical disclaimer visible     | Present in onboarding + settings                                                  |

---

## Dependency Graph

```
Phase 1 (Foundation)
    │
    ├───────────────────────┐
    ▼                       ▼
Phase 2 (Domain)      Phase 3 (State & Shell)
    │                       │
    └───────────┬───────────┘
                ▼
         Phase 4 (Features)
                │
                ▼
         Phase 5 (Notifications)
                │
                ▼
         Phase 6 (Polish & Ship)
```

---

## Tech Stack Summary

```
Runtime:        Angular 20+
State:          Angular Signals (service-based)
Storage:        Dexie.js → IndexedDB
UI:             Custom SCSS + Angular CDK
Calendar:       Custom component (CDK a11y)
Dates:          date-fns v3+
i18n:           ngx-translate (runtime, JSON)
PWA:            @angular/service-worker
IDs:            crypto.randomUUID()
Testing:        Vitest (Angular CLI default)
CI:             (TBD — GitHub Actions recommended)
```
