# ADR-M4: Packaging across separate repos — @stashmind/core and @stashmind/client

## Context
Cross-repo coupling between StashMind and EasyTutor must happen through a versioned package and an HTTP API, never by copying source between repos. `@stashmind/core` must be React Native / Metro safe. `@stashmind/client` must be generated from StashMind's OpenAPI file. Semver and changelogs required for both.

## Decision
1. **`@stashmind/core`** (schemas, prompts, scheduler, model-provider interface, portal config) built to ESM, CJS, and types with an `exports` map. React Native / Metro safe: no Node-only modules, no `process.env` or `Buffer` assumptions. Version 1.1.0 with changelog.
2. **Publish strategy (H2):** private npm registry if a token is available; otherwise install from a tagged git dependency (`git+https://github.com/dmuhoro/stashmind.git#packages/core@v1.1.0`). Approval required either way.
3. **`@stashmind/client`** generated from StashMind's OpenAPI 3.1 file (`api/server.ts` → `openapi.json`). Typed, versioned, changelogged.
4. **Semver:** breaking changes bump major; features bump minor; fixes bump patch. Changelog entries follow `Keep a Changelog`.
5. **Acceptance (M2):** a clean EasyTutor checkout installs `@stashmind/core` and Metro bundles it.

## Consequences
- **Positive:** Versioned, explicit coupling; no source duplication; RN-safe core; generated client stays in sync with the OpenAPI spec.
- **Negative:** Publishing requires a registry token or tagged-git approval (H2); version drift between core and client must be managed; conformance tests (ADR-M5) keep schemas honest.
- **Cross-links:** ADR-M1 (integration), ADR-M2 (service account), ADR-M5 (model provider interface lives in core). EasyTutor mirrors in `docs/adr/`.
