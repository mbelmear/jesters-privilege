# Jester's Privilege

Website for the Jester's Privilege podcast. The agreed v1 spec is `docs/spec.md` (it supersedes the starting brief in `docs/brief.md`). Deferred ideas go in `LATER.md`, not into the build.

## Working rules

- **One worktree per ticket.** Several sessions build tickets at once, so implement each ticket in its own git worktree on its own branch, created from `origin/main` with `npm run worktree -- <issue> <branch>`, which also installs dependencies; once its PR merges, `npm run worktree-done -- <pr>` removes the worktree and branch. The main checkout belongs to the human; to read the latest main, `git fetch` and use `origin/main`.
- **Vocabulary.** Use `GLOSSARY.md` terms in code, copy, tickets, and tests. In particular: "Jester" means only Michael, Dan, or Aaron; a historical figure is a "Fool".
- **Test first.** Build logic with the `tdd` skill (Jest + React Testing Library + jest-axe). Browser behavior is covered by Playwright; performance by Lighthouse CI. How to run each layer: `docs/testing.md`.
- **Design principle.** Modern construction, deliberate historical callbacks. Respect reduced motion.
- **Content lives in content files**, never hard-coded in components. Every sentence a visitor reads is a `Copy`, marked `draft: true`, written at realistic length, until `docs/spec.md` quotes it or the Jesters supply or approve it. Text rewritten after a Jester approved it is draft again, so a ticket names the pieces that stay draft. Bare interface labels ("Play", "Episode") are final as written. Before drafting copy, read the copy principle (`docs/spec.md`, Content) and the Jesters' inputs on #6 and in `docs/inputs/`.
- **Merging.** `merge`, `mark-ready`, and `pr-status` wait about 30 minutes for CI, sometimes over an hour, so run them in the background, unpiped, so the exit code is theirs. A docs-only PR (`docs/testing.md`, In CI) merges after about 2 minutes.
  - Every PR: commit, then run `/code-review` (against `CODING_STANDARDS.md`) with `origin/main` as the fixed point; it reviews committed work only. A docs-only PR under 20 changed lines, and any fix round on one, is instead reviewed inline, without subagents, against the same standards and its ticket, each figure checked against its source. When it finds nothing serious (no documented standard broken, nothing missing or wrong against the spec, a wrong figure included), record it with `npm run review-passed -- <n> <reviewed full SHA>`. `merge` and `mark-ready` refuse a head without that comment; `merge` also refuses any failing, pending, or missing check, and any commit main gained in the PR's files, until it has been read. For any commits after that SHA, review fixes included, review again (`/code-review`, or inline on such a docs-only PR) with the last reviewed SHA as the fixed point (`origin/main` after a rebase), then record a new `review-passed` on the new head. A small fix round (one commit, one source file and its test, under 50 changed lines) gets a lighter review: Standards reads only the `CODING_STANDARDS.md` sections the diff touches, and Spec rechecks the ticket's acceptance criteria (or "Done when"), and any figure the fix changed. A wording judgement call is not serious, so it never starts a round of its own: fold it into the fix for a serious finding, reviewed with it, or leave it.
  - Logic/infra PRs: merge with `npm run merge -- <n>` once reviewed.
  - Visual PRs (anything a visitor sees that the diff changes; content that arrives later through the Feed or a workflow, such as a machine Transcript, doesn't count), once reviewed: check the built page with `npm run screenshots -- <path>` (phone and desktop, light and dark; `--click "<button>"` and the other steps in `scripts/screenshots.ts`'s header for a state reached by interaction, `--storage <key>=<json>` for one from this device's history, `--element <selector>` for just the header or footer), comment on the PR what the Jester should look at on the preview (CI posts its URL; it reads the live feed, so name addresses the preview has), apply the `ready-for-human` label with `npm run mark-ready -- <n>` (it refuses an unreviewed head, waits for the head's checks and preview, and refuses unless all pass and it merges cleanly), and wait for a Jester to approve. Do not merge them yourself. `npm run pr-status -- <n>` runs the same wait without labelling; a "Conflicts with main" comment means merge `origin/main` in before the Jester looks.

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
