# Deluminate - Agent Context

## Overview
Chrome extension to invert website luminance. Features: full inversion, smart image handling, low contrast, dimming.

**Tech Stack:** JS (ESM), HTML, CSS, Manifest V3.
**Testing:** Mocha (Unit), Playwright (E2E), C8 (Coverage).
**Linting:** ESLint.

## Architecture
*   **Entry:** `manifest.json` (config, permissions).
*   **Background:** `background.js` (lifecycle, programmatic injection).
*   **Content:**
    *   `content_logic.js`: Core analysis algorithms (injected first).
    *   `deluminate.js`: DOM manipulation & injection entry.
    *   `deluminate.css`: Inversion styles.
*   **UI:** `popup.{html,js}`, `options.{html,js}`.
*   **Shared:** `common.js` (settings/state), `utils.js` (helpers).
*   **Tests:**
    *   `spec/`: Pure logic unit tests (Mocha, JSDom, no extension APIs).
    *   `e2e/`: Full extension integration tests (Playwright).

## Concepts & Data Flow
*   **Smart Inversion:** Hybrid approach. Global CSS `filter: invert()` flips the page; `content_logic.js` analyzes images/videos and selectively re-inverts them to look normal.
*   **Settings Sync:** UI updates `chrome.storage.sync`. Background worker listens for storage changes → broadcasts `update_tabs` message → Content Scripts apply new settings.
*   **Injection:** Content scripts are injected programmatically by `background.js` (not manifest) to ensure order and reliability.

## Workflow
**Setup:** `npm install` && `npx playwright install`.

**Scripts (defined in `package.json`):**
*   `npm test`: Run unit tests.
*   `npm run test:e2e`: Run E2E tests.
*   `npm run lint`: Check code style.
*   `npm run package`: Build `deluminate.zip` for distribution.

## Conventions
*   **Style:** Strict ESLint adherence (`eslint.config.mjs`).
*   **Testing:** Unit tests required for new logic.
*   **Commits:** Standard git conventions.