IMPORTANT: never use rm, rmdir commands

You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` decorator
- Prefer inline templates for small components
- Prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection

## Testing Approach
- If a test fails, do not try to fix it blindly.
- Read the logs, then ask the human developer for assistance.
- Update this file with the error details.

## Known Issues
- [Date] - Issue with [Specific Module]: Previously, the agent failed to handle X. If this occurs, assume the issue is [Y].
- 2026-06-04 - Vitest / Dexie service specs: the test environment does not expose IndexedDB, so direct Dexie-backed service specs raise `MissingAPIError IndexedDB API missing`. Use a mocked `db`/`liveQuery` test harness for service coverage in this repo.
- 2026-10-17 - Sync reliability validation: `sync-storage.service.spec.ts` expected 25 mocked unresolved conflicts but the `toSignal(liveQuery(...))` value was still its empty initial value at assertion time. The same run had 50 passing tests.
- 2026-10-17 - App route validation: `app.spec.ts` still expects a `.quick-log-card`, but the current dashboard template does not render that selector; the suite also reported the known `MissingAPIError IndexedDB API missing` from this spec's real Dexie-backed services.
- 2026-10-17 - Angular production build: `ng build` and `ng build --verbose` exit with code 134 immediately after `Building...` and emit no diagnostics under Node v24.17.0; `tsc --noEmit -p tsconfig.app.json` succeeds.
- 2026-10-17 - Full Vitest suite after sync work: 62 tests passed and 15 unrelated tests failed. Calendar, log-overlay, and home-card specs lack a `TranslateService` provider; select/select-option specs have stale setup for required signal inputs/projected options; day-details sets obsolete `dateLabel` instead of `dateKey`; cycle-prediction expects cycle/period lengths that the current service does not pass to `PredictionEngine`. The focused 52-test sync/app/profile suite passes.
