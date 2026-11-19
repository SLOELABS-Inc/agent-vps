# 01. One login took every agent down for 26 hours

**What happened.** Every Claude Code process on the box shared one refreshable login. At 13:07 UTC one day it stopped
working, and every Claude run on the box failed for about 26 hours: the main assistant, the hourly crons (126 failed
runs in a row), the Telegram bot and the remote-control sessions. Nothing alerted.

**Cause (most likely, not proven).** A refreshable login's refresh token rotates when it is used. The only Claude
activity between the last success and the first failure was three ad-hoc headless `claude -p` runs alongside the
long-running sessions. Concurrent refreshes on one shared login are the likely race.

**What changed.**
- Unattended processes use a non-rotating setup-token passed as `CLAUDE_CODE_OAUTH_TOKEN`.
- Features that need a full login get their own config dir and their own login.
- Ad-hoc `claude -p` on the shared login is blocked by a hook (`guards/bash-guard.cjs`).
- 126 silent failures was its own bug: alert on consecutive failures of agent jobs.

**Rule.** AGENTS.md rule 4. Runbook: `runbooks/agent-logins.md`.
