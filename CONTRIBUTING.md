# Contributing

Thanks for your interest. This is the website of one podcast, built and maintained by one of its Jesters, and **it doesn't take outside contributions**. Only the maintainer can open pull requests, and outside issues and comments are turned off until 2027-05-23, when GitHub's six-month interaction limit lapses (#282 renews it). The code is public to be read and learned from, under the [MIT License](LICENSE).

## If you want to reach the show

- **A Question, a Confession, a Topic idea, or a correction to a Transcript**: use [Speak Freely](https://jestersprivilegepodcast.com/speak-freely) on the site.
- **A security problem**: report it privately as [`SECURITY.md`](SECURITY.md) describes.

## If you want to learn from the code

Start with [`docs/architecture.md`](docs/architecture.md), how the platform is built and how it works; the README's [Documentation](README.md#documentation) table maps the rest.

Forking and reusing the code is welcome under its license. The show's name, logos and artwork, the Jesters' photos, the site's copy, and the Episodes are not covered by it; see [`README.md`](README.md), License.

## How the build itself works

Work is built agent-first. Each change is a GitHub issue, built test-first by a coding agent in its own git worktree, reviewed against [`CODING_STANDARDS.md`](CODING_STANDARDS.md) and its ticket, and merged only once CI and a required review gate pass. Anything a visitor sees also waits for a Jester to approve its preview. The working rules are in [`AGENTS.md`](AGENTS.md).
