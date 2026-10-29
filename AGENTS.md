# Jester's Privilege

Website for the Jester's Privilege podcast. The agreed v1 spec is `docs/spec.md` (it supersedes the starting brief in `docs/brief.md`). Deferred ideas go in `LATER.md`, not into the build.

## Working rules

- **One worktree per ticket.** Several sessions build tickets at once, so implement each ticket in its own git worktree on its own branch, created from `origin/main` with `npm run worktree -- <issue> <branch>`, which also installs dependencies. The main checkout belongs to the human.
- **Vocabulary.** Use `GLOSSARY.md` terms in code, copy, tickets, and tests. In particular: "Jester" means only Michael, Dan, or Aaron; a historical figure is a "Fool".
- **Test first.** Build logic with the `tdd` skill (Jest + React Testing Library + jest-axe). Browser behavior is covered by Playwright; performance by Lighthouse CI. How to run each layer: `docs/testing.md`.
- **Design principle.** Modern construction, deliberate historical callbacks. Respect reduced motion.
- **Content lives in content files**, never hard-coded in components. Copy awaiting the Jesters' words is marked `draft: true`, written at realistic length.
- **Merging.**
  - Logic/infra PRs: commit, then run `/code-review` (against `CODING_STANDARDS.md`) with `origin/main` as the fixed point; it reviews committed work only. When it finds nothing serious, record it with `npm run review-passed -- <n> <reviewed full SHA>`, then merge with `npm run merge -- <n>`. The script refuses a head without that comment and any failing, pending, or missing check. Each push after a review gets its own `/code-review` before a new comment, with the last reviewed SHA as the fixed point so it covers only the new commits (`origin/main` again after a rebase).
  - Visual PRs (anything a visitor sees): post the Cloudflare preview URL on the PR, apply the `ready-for-human` label with `npm run mark-ready -- <n>`, and wait for a Jester to approve. Do not merge them yourself.

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
