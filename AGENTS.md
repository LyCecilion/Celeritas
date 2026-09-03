# AGENTS.md

Agent-facing conventions for the Celeritas repository. Follow these rules for every
change. Human-facing docs (README, CHANGELOG) stay in Chinese; code comments, git
history, and agent docs are English.

## Project

- Tampermonkey userscript for the university course-selection page. Runs in the
  browser; reuses the page's `axios` instance and `grablessonsVue` globals.
- Distributed as a single file: `celeritas.user.js` (built artifact, committed).

## Repository layout

| Path | Role |
|---|---|
| `src/main.js` | Runtime: UI, page API calls, workers. Uses the `byId()` DOM helper. |
| `src/core.js` | Pure logic only (no DOM/axios). Strictly type-checked and unit-tested. |
| `src/globals.d.ts` | Types for page globals (`axios`, `grablessonsVue`, `webkitAudioContext`). |
| `scripts/build.mjs` | esbuild bundle; injects `// @version` from `package.json`. |
| `celeritas.user.js` | **Build artifact — never edit by hand.** Edit `src/`, then run `pnpm build`. |
| `tests/` | Vitest unit tests for pure logic. |
| `jsconfig.json` | Type-check configuration. |
| `.github/workflows/` | `ci.yml` (push/PR quality gate), `release.yml` (`v*` tag release). |
| `pnpm-workspace.yaml` | pnpm settings (`allowBuilds: esbuild: true`). |

> Keep the project-structure tree in README.md in sync when this layout changes.

## Working rules

- **Version**: single source of truth is `package.json.version`. `pnpm build` injects
  it into the userscript header. `pnpm check:artifact` (rebuild + `git diff`) proves
  the committed artifact is current; CI enforces the same.
- **Comments**: English, unified style — `// ===================== Section =====================`
  separators, `//` inline, `/** JSDoc */` for exported functions. UI strings, `log()`
  messages, README, and CHANGELOG stay Chinese.
- **Types**: never use `any` / `as any` (project rule `ts-no-any`). Prefer `unknown`
  + type guards, domain types (`ApiResponse`), or a justified cast with a one-line
  reason. `core.js` and `tests/` are strictly checked via `// @ts-check`; `main.js`
  keeps editor-level checking (page API is untyped) — do not mass-annotate it.
- **Naming**: `clrt-` prefix for all DOM ids/classes. Storage key `clrt_courses_*`;
  `LEGACY_LS_KEY` (`ccb_courses_*`) exists only for one-time migration — keep it.
- **New logic**: computation-heavy code goes to `src/core.js` with Vitest tests.
  Test observable behavior (boundaries, defaults, transitions), not implementation.

## Quality gates (before yielding)

```bash
pnpm check            # prettier format:check + eslint + typecheck + vitest run
pnpm build            # regenerate celeritas.user.js
pnpm check:artifact   # rebuild and assert the artifact is unmodified
```

Never skip: every PR must be green on CI before it is merged.

## Git Flow

- `main`: production only — receives `release/*` PRs (and urgent `hotfix/*`).
- `develop`: integration branch; the default working branch.
- Features: `feature/<name>` from `develop` → PR to `develop`.
- Releases: `release/vX.Y.Z` from `develop` → PR to `main`; after merge, tag `vX.Y.Z`
  on `main` and push — the release workflow builds and publishes. Then merge the
  release branch back to `develop` and delete it.
- Hotfixes: `hotfix/<name>` from `main` → PR to `main`, then merge back to `develop`.
- Use merge commits (`--merge`), never squash or fast-forward.
- Delete branches after they are merged.
- `main` and `develop` are branch-protected: the `quality` CI check must pass before any merge.

## Commits

Conventional commits with gitmoji, **in English**:

```
<type>: :emoji: <subject>
```

Emojis used in this repo: `:truck:` refactor/moves, `:white_check_mark:` tests,
`:construction_worker:` CI, `:bug:` fixes, `:memo:` docs, `:rocket:` releases,
`:package:` merge-backs, `:tada:` initial release. One logical change per commit;
add a `- bullet` body when the subject alone is not enough.

## Releasing

1. `git checkout -b release/vX.Y.Z develop`
2. Update `CHANGELOG.md`: move `[Unreleased]` content into `## [vX.Y.Z] - YYYY-MM-DD`
   (keep an empty `[Unreleased]` section at the top).
3. Bump `package.json` version, run `pnpm build`, commit the artifact.
4. PR `release/vX.Y.Z` → `main`, merge.
5. `git tag vX.Y.Z && git push origin vX.Y.Z` — `release.yml` verifies the tag matches
   the `package.json` version, runs `pnpm check`, builds, and creates the GitHub
   Release with `celeritas.user.js` as an attachment (notes from the CHANGELOG).
6. Merge the release branch back to `develop`, then delete it.

The release workflow fails if the CHANGELOG section for the version is missing or
the tag does not match `package.json.version`.

## Pre-merge checklist

- [ ] `pnpm check` and `pnpm check:artifact` pass
- [ ] Comments English; UI strings Chinese
- [ ] Tests added/updated when behavior changed
- [ ] CI green, then merged with a merge commit
