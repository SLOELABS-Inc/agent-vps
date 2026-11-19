# One worktree per task

Git has one HEAD per checkout. Two agents working in the same clone move each other's branch, and on a server that
also moves whatever cron or service reads that clone.

```bash
git clone <url> /srv/work/<repo>            # once: a plain clone used only as the worktree parent
cd /srv/work/<repo>
git fetch origin
git worktree add /srv/work/<repo>-<task> -b <branch> origin/main
# … work, commit, push, open a PR …
git worktree remove /srv/work/<repo>-<task>   # after merge
```

- One worktree per **task**, not per agent: two sessions of the same agent collide just as easily.
- Push with an explicit target (`git push origin HEAD:<branch>`) if a worktree's upstream was set to `main` by mistake.
- Prune old worktrees weekly; each one holds a full `node_modules`.
