# 05. The review nobody read

**What happened.** A small feature (a phone menu) had green CI. At 01:37 UTC the review bot asked for one low-severity
change. The agent that opened the PR had moved on, and nothing was watching the review. The PR sat for 19 hours until
the founder asked, angrily, why a menu was taking two days.

The fix took a few minutes once someone looked. Each new push got a new review, and every round found one more real,
small issue: a route the dock should never show, a Home fallback to a page the user might not be allowed to open, an
end-to-end test that silently skipped when its login was missing.

**Cause.** Automated review has no owner by default. "Open a PR and stop" is correct for merging, and wrong for
everything that comes after: a `needs_changes` verdict with nobody subscribed to it is a dead end.

**What changed.** The agent that opens a PR watches it until it merges or is closed: it polls for the verdict and
fixes findings as they arrive. A review verdict older than an hour with no new push pages a human.

**Rule.** Review is a service, and every PR has an owner until it merges.
