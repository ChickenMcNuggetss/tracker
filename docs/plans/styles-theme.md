# Extract SCSS Theme Layer Into `src/theme`

## Summary
Create a shared SCSS theme layer under `src/theme/` and refactor the current hard-coded styling to consume it. This pass should do real extraction and wiring, not just scaffolding, and should include a class-based dark theme structure for future toggling.

## Key Changes
- Add `src/theme/_variables.scss` with CSS custom properties in `:root` for:
  - Core colors used today in the home page and button styles
  - Surface, text, border, accent, and shadow tokens
  - Spacing and radius tokens for repeated values like `0.6rem`, `1rem`, `1.4rem`, `1.5rem`, `2rem`, `999px`
  - Motion tokens for the shared transition timing already repeated in button/day/nav styles
- Add `src/theme/_typography.scss` with:
  - Base font-family token for the current `'Avenir Next', 'Nunito', 'Segoe UI', sans-serif`
  - Font-size and font-weight custom properties for repeated label/body/title/button sizes
  - Optional small utility mixins/placeholders only if needed to keep component SCSS readable
- Add `src/theme/_dark-mode.scss` with class-based overrides:
  - Scope overrides under a root selector such as `body.theme-dark`
  - Override only shared CSS custom properties, not component selectors directly
  - Provide dark equivalents for page background, cards, text, muted text, borders, button gradients, selected/today/period states
- Add `src/theme/_mixins.scss` with:
  - Breakpoint mixins for the existing `720px` and `560px` responsive cutoffs
  - A small accessibility helper mixin only if used immediately, such as a visually-hidden utility or focus-ring helper
- Update `src/styles.scss` to `@use` the theme partials so global custom properties and dark-mode overrides are emitted once from the app stylesheet
- Refactor existing SCSS to consume the theme layer:
  - `src/app/pages/home/home-page.scss`: replace repeated raw colors, radii, font values, and media queries with `var(...)` tokens and shared mixins
  - `src/app/shared/components/button/button.component.scss`: replace literal gradients/shadows/radius/font values with theme tokens
  - Leave layout-specific values local unless they are clearly reused or belong to design tokens

## Public Interface / Conventions
- New shared theme entrypoints under `src/theme/`:
  - `_variables.scss`
  - `_typography.scss`
  - `_dark-mode.scss`
  - `_mixins.scss`
- New global runtime contract:
  - Theme values are consumed through CSS custom properties
  - Dark mode is activated by applying a root class such as `theme-dark` to `body`
- No Angular component API changes are required in this pass unless a dark-mode toggle already exists elsewhere

## Test Plan
- Build/test check that SCSS compilation succeeds with the new `@use` structure
- Verify the current home page renders visually the same in default mode after token extraction
- Verify responsive behavior still matches current breakpoints at widths above `720px`, below `720px`, and below `560px`
- Verify adding `theme-dark` to `body` switches shared colors without unreadable text or low-contrast surfaces
- Verify focus-visible states remain clear and WCAG AA-safe after tokenization, especially for buttons and calendar day cells

## Assumptions
- “Create according files” means creating the files and wiring existing styles into them, not only scaffolding
- The current visual design should be preserved in light mode as closely as possible
- Dark mode should be prepared via class-based overrides, not system-only detection
- Since there is no existing style preprocessor alias config, imports should use relative `@use` paths from `src/styles.scss` and local component SCSS as needed
