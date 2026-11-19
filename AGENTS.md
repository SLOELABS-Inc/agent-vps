# AGENTS.md — rules for every coding agent on this box

> Single source of truth. Codex reads this file; Claude reads it through `CLAUDE.md` (which contains only `@AGENTS.md`).
> Keep it under ~40k characters. Rules live here; long evidence lives in `runbooks/` and `incidents/`, behind a link.

## Who decides what

- **Free, no approval:** reading, querying, drafting, research, health checks, opening PRs, fixing review findings.
- **Pre-authorised:** merging a PR that CI and the review bot passed, and deploying merged `main` by pull.
- **Stop and ask <OWNER> first:** production schema or data migrations, moving money, rotating or creating
  credentials, sending anything to a customer or the public, deleting data, anything you are under 80% sure of.

When you ask <OWNER> to do something, put the direct link in the same message (the PR, the settings page), never
"in the dashboard".

## Hard rules

1. **Never edit, branch or build in the runtime checkout (`/srv/runtime`).** It moves only by
   `git pull --ff-only origin main` of merged code. Never `git stash -u` or `git clean` there: untracked state lives in it.
2. **One worktree per task:** `git worktree add /srv/work/<repo>-<task> -b <branch> origin/main`. Never commit in a
   shared clone.
3. **Never merge your own PR.** No `gh pr merge` (no `--auto`, no `--admin`). Open a ready PR and stop; the review bot
   merges what it approves. If it asks for changes, fix them and push.
4. **Never run ad-hoc headless `claude -p` on the shared login.** Unattended processes use their own setup-token
   (`runbooks/agent-logins.md`).
5. **Only the `coder` tmux session loads the Telegram channel.** A second session with the plugin enabled steals the
   bot (`runbooks/telegram-channel.md`).
6. **Never put a secret in chat, a PR, an issue or a commit.** Tell <OWNER> where to put it (`/srv/secrets/.env`).
7. **Verify, don't assume.** "Done" from a human, a tool or a deploy is a claim. Probe the real state afterwards.

## Evidence before claims

- Before saying something does not exist, search the code, the env and the vendor's API.
- Before quoting a number (users, revenue, usage), check it against production and say what it counts.
- Label anything you did not verify as `unverified`.

## Testing

- **E2E first.** Hit the real endpoint, check the real state, and leave an artifact a human can open (a JSON dump, a
  screenshot, a report).
- **Unit tests only for things that must be exact in isolation** (permissions, money, dates, two implementations that
  must agree), and write the failure modes down *before* the code.
- **Never** a test that greps source text or re-implements the function it tests.

## Human-only steps go first

Some things an agent cannot do: create an account, finish 2FA or OAuth consent, enter payment details, click a
dashboard button that has no API. List every one of them at plan time, with: what, where (URL), where the result goes,
and what it unblocks. Then start on everything else.

## Two agents, side by side

For planning, research and infrastructure, brief the other agent (Codex ↔ Claude) at the start, not after you have
decided. The brief asks questions, asserts nothing, and demands a `path:line` or an exact command and its output for
every answer.

## <PROJECT-SPECIFIC>

<Your products, where production lives, which database is prod, how to deploy each service, who the customers are.
Keep traps here: "column X does not mean what it says", "this env var is read in two places".>
