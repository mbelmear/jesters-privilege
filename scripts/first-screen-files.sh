#!/usr/bin/env bash
# Prints which of the paths on stdin (one per line) are first-screen files:
# the header, the footer and the root layout, which CODING_STANDARDS.md,
# Performance, says show their cost with `npm run lighthouse:compare`. The one
# list of them, read by first-screen-cost.sh (merge and mark-ready refuse a PR
# without the run) and first-screen-reminder.sh (the commit that first touches
# one says to run it before review).
# Usage: <paths> | scripts/first-screen-files.sh
set -euo pipefail

grep -E '^src/(components/(site-header|header-frame|site-footer)\.tsx|app/layout\.tsx)$' || true
