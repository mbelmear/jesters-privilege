# Jester's Privilege

Website for the Jester's Privilege podcast. The agreed v1 spec is `docs/spec.md` (it supersedes the starting brief in `docs/brief.md`). Deferred ideas go in `LATER.md`, not into the build.

## Working rules

- **One worktree per ticket.** Several sessions build tickets at once, so implement each ticket in its own git worktree on its own branch, created from `origin/main` (the EnterWorktree tool, or `git worktree add ../jp-<issue> -b <branch> origin/main`). The main checkout belongs to the human. To find tickets ready to start: `npm run ready`.
- **Coding standards.** Before writing or reviewing code, read `CODING_STANDARDS.md`: the TypeScript and React rules `/code-review` checks.
- **Vocabulary.** Use `GLOSSARY.md` terms in code, copy, tickets, and tests. In particular: "Jester" means only Michael, Dan, or Aaron; a historical figure is a "Fool".
- **Test first.** Build logic with the `tdd` skill (Jest + React Testing Library + jest-axe). Browser behavior is covered by Playwright; performance by Lighthouse CI. How to run each layer: `docs/testing.md`.
- **Design principle.** Modern construction, deliberate historical callbacks. Respect reduced motion. (Colors and fonts come only from design tokens; ESLint enforces it.)
- **Content lives in content files**, never hard-coded in components. Copy awaiting the Jesters' words is marked `draft: true`, written at realistic length.
- **Merging.**
  - Logic/infra PRs: merge only when every check is green and a `code-review` pass finds nothing serious. Always merge with `npm run merge -- <n>` (`scripts/merge-on-green.sh`: it waits for every check, stops at the first failure, then squash-merges and deletes the branch); never merge a PR with a failing or pending check.
  - Visual PRs (anything a visitor sees): post the Cloudflare preview URL on the PR, apply the `ready-for-human` label, and wait for a Jester to approve. Do not merge them yourself.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for mbelmear/jesters-privilege (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
