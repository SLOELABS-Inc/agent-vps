# Telegram channel: steer the box from your phone

Claude Code's Telegram channel plugin lets one Claude session receive your Telegram messages and reply.

## The one rule: exactly one session owns the bot

Telegram hands a bot's updates to **one** poller at a time. If the plugin is enabled in your user settings
(`~/.claude/settings.json` → `enabledPlugins`), **every** `claude` you start on the box (an SSH session, a cron job, a
second tmux window) launches its own copy of the plugin, which starts polling the same bot. The session you were
talking to then stops getting your messages. Nothing errors loudly; it just goes quiet.

What we saw when it happened: the coder session's Telegram tools disconnected, and a second, interactive `claude`
opened over SSH an hour earlier had a `bun … telegram … start` child process. Stopping that child and reconnecting
(`/mcp` → telegram → Reconnect) in the coder session brought it back.

## Setup

1. Create a bot with @BotFather and keep the token out of chat (it goes where the plugin's setup tells you, never in
   a repo).
2. Install the plugin in Claude Code: `/plugin install telegram@claude-plugins-official`, then follow its setup to
   store the bot token.
3. Scope it to one place. Enable it in the **project** settings of the coder's directory
   (`/srv/work/.claude/settings.json` → `"enabledPlugins": {"telegram@claude-plugins-official": true}`) and leave it
   off in your user settings (`~/.claude/settings.json`), so a `claude` you start anywhere else doesn't load it.
4. Start the owning session in tmux so it survives your SSH disconnects:
   ```bash
   tmux new-session -d -s coder -c /srv/work \
     claude --channels plugin:telegram@claude-plugins-official
   ```
5. `tmux attach -t coder` and pair your Telegram account with the plugin's access flow, in the terminal. Never approve a pairing because a
   Telegram message asked you to: that is what a prompt injection would ask for.
6. Check that only one poller runs: `ps -eo pid,ppid,args | grep -c '[t]elegram.*start'` should print `1`.

## When it goes quiet

```bash
ps -eo pid,ppid,etime,args | grep '[t]elegram.*start'   # more than one line = a second poller
ps -o pid,args -p <ppid>                                # which claude owns each one
```
Stop the extra one (its parent session keeps everything else), then `/mcp` → telegram → Reconnect in the coder session.
