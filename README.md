# agent-vps

Run a VPS where **Claude Code and Codex do the operating**, and you steer from your phone.

This is the setup one founder uses to run production for several products from a single Linux box. The agents write
code, open PRs, watch CI, deploy and fix things at 3am. You approve what matters from Telegram.

It is not a framework. It is a starting configuration plus the rules we learned by breaking things, each with the
incident that taught it (`incidents/`).

## What you get

| Piece | What it does |
|---|---|
| `setup/bootstrap.sh` | Fresh Ubuntu 24.04 → hardened box with Node, Claude Code, Codex, `gh`, tmux, a firewall that actually covers Docker |
| `AGENTS.md` | The rules file both agents read. Claude reads it through `CLAUDE.md`; Codex reads it directly. One source of truth |
| `guards/` | Claude Code hooks that **mechanically** block what a prompt can only ask for: prod writes, `gh pr merge`, edits in the runtime checkout |
| `runbooks/` | Deploy by pull, one worktree per task, the Telegram channel, agent logins that don't kill each other |
| `incidents/` | Five real outages, what caused them, and the rule each one produced |

## The shape

```
                 you (Telegram, phone)
                        │
        ┌───────────────┴───────────────┐
        │ tmux "coder": claude --channels│   ← one session owns the Telegram bot
        └───────────────┬───────────────┘
        builds in /srv/work/<repo>-<task>  (git worktree per task)
                        │  PR
                        ▼
              CI  +  review bot (a second model)
                        │  merge
                        ▼
        /srv/runtime  ← deploys ONLY by `git pull --ff-only` of main
```

Three rules hold the whole thing together:

1. **The runtime checkout is read-only to agents.** Production runs from `/srv/runtime`. Agents never edit, branch or
   build there; it only moves by pulling merged `main`.
2. **Every task gets its own worktree.** Git has one HEAD per checkout. Two agents in one clone move each other's
   branch, and on a server that also moves what production restarts into.
3. **Review is a service, not a favour.** The agent that wrote the code does not merge it. A second model reviews every
   PR, and nothing merges on the author's say-so.

## Quick start

```bash
# on a fresh Ubuntu 24.04 VPS, as root
curl -fsSLO https://raw.githubusercontent.com/SLOELABS-Inc/agent-vps/main/setup/bootstrap.sh
less bootstrap.sh            # read it first; it is short on purpose
OPERATOR=ops bash bootstrap.sh
```

Then, as the `ops` user:

0. `git clone https://github.com/SLOELABS-Inc/agent-vps && cd agent-vps`
1. `claude` once interactively to log in, then follow `runbooks/agent-logins.md` before running anything unattended.
2. `codex login --device-auth` (ChatGPT plan), then `codex login status`. `runbooks/agent-logins.md` covers the gotchas.
3. Install the guards: `node guards/install.mjs`.
4. Set up the Telegram channel: `runbooks/telegram-channel.md`.
5. Copy `AGENTS.md` into each repo you operate and fill in the `<…>` parts.

## What this will not do for you

- **Availability.** One VPS is one failure domain. Put your alerting somewhere that does not die with the box
  (`incidents/02-the-monitor-died-with-the-server.md`).
- **Judgement on money, credentials and customer data.** `AGENTS.md` makes those stop-and-ask. Keep it that way.

## License

MIT.
