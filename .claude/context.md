# Shared context for agent briefs

| Fact           | Value                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------- |
| Repository     | /home/fascio/projects/github/upuaut                                                                 |
| Branch model   | git flow (AVH 1.12.3): master (prod), develop (base), feature/*                                     |
| Working branch | feature/router (from develop)                                                                       |
| Off-limits     | none beyond hard limit; ../khnum is read-only                                                       |
| Spec           | docs/router.md                                                                                      |
| Dependency     | khnum ^1.0.0 (npm; source at ../khnum, read-only). API sweep: .claude/sweeps/khnum-api.md           |
| Stack          | TypeScript (strict), web components (light DOM, khnum Shape), Vite 8 lib mode, Vitest 5 + happy-dom |
| Layout         | src/ library · tests/*.test.ts · demo/ SPA (vite root, alias `upuaut` -> src/index.ts) · docs/      |
| Style          | prettier (.prettierrc.json, copied from khnum)                                                      |

## Vetting commands (from package.json)

| Check         | Command                                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| Format        | `npm run format:check`                                                                                      |
| Type-check    | `npm run typecheck`                                                                                         |
| Unit tests    | `npm run test` (one file: `npx vitest run tests/<file>.test.ts`)                                            |
| Build lib     | `npm run build`                                                                                             |
| Build demo    | `npm run build:demo`                                                                                        |
| Full gate     | `npm run check`                                                                                             |
| Browser tests | `npm run test:browser` (Vitest browser mode, headless Chromium; components, history, demo; not in `check`)  |
| E2E           | `npm run test:e2e` (Playwright 1.64.1, e2e/*.spec.ts; builds demo, `vite preview` on :4173; not in `check`) |
| API docs      | `npm run docs` (TypeDoc 0.28.20 + TS 6.0.3 in tools/typedoc; warnings are errors, notDocumented on)         |

## Host tool versions

| Tool                       | Version                                         |
| -------------------------- | ----------------------------------------------- |
| node                       | 24.15.0                                         |
| npm                        | 12.0.2                                          |
| tsc (project)              | 6.0.3 (package typescript 7.0.2)                |
| vite                       | 8.3.6                                           |
| vitest                     | 5.1.0                                           |
| prettier                   | 3.9.10                                          |
| typescript-language-server | 6.0.3                                           |
| playwright                 | 1.64.1 (chromium-headless-shell 156.0.8078.4)   |
| tree-sitter                | 0.27.1 (grammar tree-sitter-typescript f975a62) |

## Environment notes

- Global npm prefix /usr/local is root-owned: global tools go through `pnpm add -g` (~/.local/share/pnpm).

## Maps

- Anchor check excludes the maps themselves: `git grep -c -F -- '<anchor>' -- ':!.claude'` must total 1.
- `tree-sitter tags <file>` works (JS grammar linked).
- LSP references: `node .claude/scripts/lsp-references.mjs "$PWD" <file> <line0> <char0>` (verified: 13 refs of createRouter).
