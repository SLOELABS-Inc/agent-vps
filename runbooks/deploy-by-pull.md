# Deploy by pull, and only by pull

Production runs from `/srv/runtime/<repo>`. It changes in exactly one way:

```bash
cd /srv/runtime/<repo>
git fetch origin
git status --short --untracked-files=no      # must be empty: tracked edits here mean someone hotfixed in place
git pull --ff-only origin main
<load-check: import/boot the app without serving, fail = do not restart>
systemctl --user restart <service> && curl -fsS localhost:<port>/health
```

- **Never** edit, build, branch, `git stash -u` or `git clean` in the runtime checkout. Untracked runtime state (local
  data, built assets) can live there, and those commands delete it.
- **Load-check before restart.** A single process with no standby means a bad restart is a full outage.
- **Watch for drift.** A cron that compares `HEAD` with `origin/main` and pages when the runtime is behind or dirty.
  Without it, a box quietly falls hundreds of commits behind (incidents/03).
- **Merged is not shipped.** After deploying, check that the running version equals `git rev-parse origin/main`.
