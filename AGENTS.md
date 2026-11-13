# Jester's Privilege

Website for the Jester's Privilege podcast. The agreed v1 spec is `docs/spec.md` (it supersedes the starting brief in `docs/brief.md`). Deferred ideas go in `LATER.md`, not into the build; work a ticket's decisions don't cover becomes a follow-up ticket.

## Working rules

- **One worktree per ticket.** Several sessions build tickets at once, so implement each ticket in its own git worktree on its own branch, created from `origin/main` with `npm run worktree -- <issue> <branch>`, which also installs dependencies; once its PR merges, `npm run worktree-done -- <pr>` removes the worktree and branch. The main checkout belongs to the human; to read the latest main, `git fetch` and use `origin/main`.
- **Vocabulary.** Use `GLOSSARY.md` terms in code, copy, tickets, and tests. In particular: "Jester" means only Michael, Dan, or Aaron; a historical figure is a "Fool".
- **Test first.** Build logic with the `tdd` skill (Jest + React Testing Library + jest-axe). Browser behavior is covered by Playwright; performance by Lighthouse CI. How to run each layer: `docs/testing.md`.
- **Design principle.** Modern construction, deliberate historical callbacks. Respect reduced motion.
- **Content lives in content files**, never hard-coded in components. Every sentence a visitor reads is a `Copy`, marked `draft: true`, written at realistic length, until `docs/spec.md` quotes it or the Jesters supply or approve it. Text rewritten after a Jester approved it is draft again, so a ticket names the pieces that stay draft. Bare interface labels ("Play", "Episode") are final as written. Before drafting copy, read the copy principle (`docs/spec.md`, Content) and the Jesters' inputs on #6 and in `docs/inputs/`.
- **Merging.** Before opening a PR, read `docs/testing.md`, Merging. Every PR passes review first. A logic or infra PR then merges with `npm run merge`; a visual PR (anything a visitor sees that the diff changes) waits for a Jester's approval.

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
