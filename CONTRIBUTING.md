# Contributing to LO2S - OpticMesh

Report bugs and suggest improvements through [GitHub Issues](https://github.com/johnjjdave/opticmesh/issues). Include the app version, platform, steps to reproduce, and expected behavior. Share only project files and images you are permitted to publish.

## Development setup

Use Node.js 22.13 or newer and pnpm. Windows x64 is required for desktop packaging and native NDI/Spout checks.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm --dir desktop install --frozen-lockfile
pnpm exec vite build --config desktop/vite.config.ts
pnpm --dir desktop exec electron local-main.cjs
```

The local Windows launcher keeps its recovery files and preferences separate from the installed application. Rebuild the desktop interface and restart the local app after changes. The hosted web application is frozen at v0.7.0; new development targets Windows.

## Validation

```sh
pnpm test
pnpm lint
pnpm exec vite build --config desktop/vite.config.ts
```

Browser interaction tests are the `tests/*.browser.mjs` scripts. Run them against the local server with Playwright available; `PLAYWRIGHT_MODULE` can specify its installed module path, and `OPTICMESH_URL` can override the server address. Tests use dedicated fixtures and must not modify personal project files.

## Windows packaging

```sh
pnpm --dir desktop install --frozen-lockfile
pnpm exec vite build --config desktop/vite.config.ts
pnpm --dir desktop build
```

The desktop build verifies and includes the official NDI Runtime prerequisite. The native bridge is described in [native/README.md](native/README.md). Release publication is covered by [RELEASING.md](RELEASING.md).

## Pull requests

Keep changes focused and describe the resulting behavior and relevant validation. Update the Manual and changelog for user-visible changes. User documentation should describe current OpticMesh behavior with general instructions and neutral examples; development discussions and personal test results do not belong in release notes.

Preserve project compatibility and third-party copyright/license notices. Do not commit generated installers, dependency directories, recovery files, credentials, or private project data.
