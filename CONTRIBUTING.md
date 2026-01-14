# Contributing to Deluminate

## Reporting a bug

File the issue [here](https://github.com/ademuri/deluminate/issues)

## Contributing code

We welcome contributions. For small changes, just submit a pull request. For larger changes, you should file a bug first to propose the idea.

All changes should have unit test coverage (located in the `spec` directory).

You should fix any lint errors from `npm run lint`.

## Development

Deluminate is written in Javascript. To install a local copy:

1. Navigate to `chrome://extensions`
2. Turn on Developer Mode
3. Click on _Load Unpacked_
4. Select the Deluminate directory

### Running Tests

This project uses `mocha` for unit tests and `playwright` for end-to-end integration tests.

To install deps needed for linting and tests:

```bash
npm install
npx playwright install
sudo npx playwright install-deps
```

To run all tests:

```bash
npm run test:all
```

To run only unit tests:

```bash
npm test
```

To run only integration tests:

```bash
npm run test:e2e
```

## Releasing

Release checklist:

- Bump version number in `manifest.json`
- Update `CHANGELOG.md`
- Commit changes
- Tag commit `git tag vX.Y.Z`
- Run `npm run package`
- Load into local Chrome and test
- Upload to Chrome Web Store
