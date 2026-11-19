# Security

- The guards **fail open**: a hook that crashes or cannot parse its input allows the command. They are a seatbelt for
  honest mistakes by an agent, not a sandbox against a hostile one. Run agents as an unprivileged user.
- Never commit `.env` files or backups of them (`.env.bak-*` is not covered by a plain `.env*` ignore on every tool).
- Report a problem in this template privately through GitHub: Security → Report a vulnerability on this repository.
