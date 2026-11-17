# Naming zizmor's findings in the Nightly failure report

Nightly's failure report names the zizmor job when it fails and says where
the fix goes, but it doesn't list each finding (file, line, rule).

## Why this is out of scope

Every finding about the repo's own workflow files is caught offline before
it merges: CI's Lint workflows job and the commit hook both run zizmor. The
online run in Nightly adds only GitHub's security advisories and a check
that a pinned action's commit belongs to that action, so a Nightly zizmor
failure is rare and usually a single finding. The report already links the
run, and the job's log lists each finding plainly, one click away.

Naming them in the report would mean parsing zizmor's output. The repo's
coding standards require a parser's fake to copy real output, with its date,
so it would also mean forcing a finding to capture a log, then keeping the
parser in step with zizmor's format across upgrades. That's ongoing upkeep
for a rare failure the linked log already explains.

## Prior requests

- #224: "Nightly's failure report names zizmor's findings"
