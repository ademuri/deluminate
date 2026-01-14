# Deluminate - Agent Context

## Project Overview

Deluminate is a Google Chrome (and Chromium) extension that inverts the luminance of websites to make them easier on the eyes. It offers various modes including full inversion, smart image handling, low contrast, and dimming.

**Tech Stack:**
*   **Core:** JavaScript (ES Modules), HTML, CSS.
*   **Extension Model:** Manifest V3.
*   **Testing:** Mocha (Unit), Playwright (E2E), C8 (Coverage), JSDom.
*   **Linting:** ESLint.

## Architecture

*   **Manifest (`manifest.json`):** Defines the extension configuration, permissions (`tabs`, `storage`, `scripting`), and entry points.
*   **Background Service Worker (`background.js`):** Handles extension lifecycle events and message passing.
*   **Content Scripts (`deluminate.js`):** The core logic injected into web pages to manipulate the DOM and apply CSS filters for inversion.
*   **UI:**
    *   **Popup (`popup.html` / `popup.js`):** The primary user interface for toggling modes and settings quickly.
    *   **Options (`options.html` / `options.js`):** A full-page settings interface for advanced configuration.

## Getting Started

### Prerequisites
*   Node.js and npm

### Installation
1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Install Playwright browsers (for E2E tests):
    ```bash
    npx playwright install
    ```

## Development Workflow

### Scripts
*   **Linting:**
    ```bash
    npm run lint
    ```
*   **Unit Tests (Mocha):**
    ```bash
    npm test
    ```
*   **End-to-End Tests (Playwright):**
    ```bash
    npm run test:e2e
    ```
*   **Run All Tests:**
    ```bash
    npm run test:all
    ```
*   **Package Extension:**
    ```bash
    npm run package
    ```
    This creates a `deluminate.zip` file excluding unnecessary development files.

### Makefile Targets
*   `make package`: Creates the zip file.
*   `make clean`: Removes build artifacts.
*   `make test`: Runs unit tests.

## Key Files & Directories

*   `manifest.json`: Extension entry point and configuration.
*   `deluminate.js`: Main logic for page inversion.
*   `background.js`: Background process handling.
*   `spec/`: Unit tests using Mocha.
*   `e2e/`: End-to-End tests using Playwright.
*   `deluminate.css`: Core CSS used for inversion effects.

## Conventions

*   **Code Style:** Adhere to the ESLint configuration (`eslint.config.mjs`).
*   **Testing:** All new features or bug fixes must include unit tests.
*   **Commits:** Follow standard git commit message conventions.
*   **Documentation:** Significant changes should update the README.
