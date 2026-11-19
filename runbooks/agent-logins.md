# Agent logins that don't take each other down

## Claude Code

A normal `claude` login is refreshable: its refresh token **rotates when used**. Several processes sharing that login
on one box can race, and the loser can invalidate it for everyone (incidents/01).

- **Interactive sessions** (you, in tmux): the normal login is fine.
- **Anything unattended** (cron, CI helpers, scripts, a second always-on agent): give it a long-lived setup-token from
  `claude setup-token`, passed to that process as `CLAUDE_CODE_OAUTH_TOKEN`. Setup-tokens don't rotate. They are
  inference-only, so features that need a full login (such as Remote Control) need their own config dir
  (`CLAUDE_CONFIG_DIR=~/.claude-rc`) with its own login.
- Never run ad-hoc `claude -p` against the shared login. The guard blocks the common spellings unless the command sets
  its own token; it is a seatbelt, not a sandbox.

## Codex (ChatGPT plan)

- Log in with `codex login --device-auth` (works over SSH), then confirm with `codex login status`.
- If a key-based env var such as `OPENAI_API_KEY` is set, Codex may use it instead of your plan. Unset it for Codex
  processes (`env -u OPENAI_API_KEY codex …`).
- Never copy `~/.codex/auth.json` into another `CODEX_HOME` to "share" the login. Two copies refresh independently and
  break each other.
- A long-lived `codex app-server` daemon can hold a stale token after you log in again. If calls fail with an auth
  error right after a fresh login, look for and stop the old daemon.

## Watch for it

Every one of these failures is silent: a cron that can't think just exits non-zero. Alert on **consecutive failures**
of your agent jobs, from somewhere outside the box.
