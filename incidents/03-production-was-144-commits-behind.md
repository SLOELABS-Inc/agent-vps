# 03. Production was 144 commits behind, and nobody knew

**What happened.** The server's production checkout was found 144 commits behind `main`, with uncommitted edits in
its working tree. The documented deploy had been silently broken: fixes we believed were deployed were in git and not
on the server.

**Cause.** Files had been hotfixed directly on the server. The tree was dirty, the deploy stopped working, and the gap
grew without anyone noticing.

**What changed.**
- The runtime checkout moves only by `git pull --ff-only` of merged `main`. A hook blocks commits, branches, stashes and
  cleans there.
- A cron compares the runtime with `origin/main` every 30 minutes and pages on drift.
- After every deploy, check that the running version equals `origin/main`. Merged is not shipped.

**Rule.** AGENTS.md rule 1. Runbook: `runbooks/deploy-by-pull.md`.
