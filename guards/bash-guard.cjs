#!/usr/bin/env node
// Claude Code PreToolUse hook for Bash. A rule in a prompt is advisory; an agent running unattended with permissions
// skipped will eventually break it. This makes the hard rules in AGENTS.md mechanical.
// Exit 2 = block (stderr goes back to the agent). Exit 0 = allow (stdout is shown as a note when non-empty).
// Config: guards/config.json next to the installed copy (~/.claude/hooks/agent-vps-guard.config.json).
const fs = require("fs");
const path = require("path");

const cfgPath = path.join(__dirname, "agent-vps-guard.config.json");
const cfg = Object.assign(
  { runtimeDirs: ["/srv/runtime"], prodPatterns: [], allowHeadlessClaude: false },
  fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, "utf8")) : {},
);

let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  let cmd = "", cwd = process.cwd();
  try { const j = JSON.parse(input); cmd = String(j.tool_input?.command ?? ""); cwd = j.cwd || cwd; } catch { process.exit(0); }
  const verdict = check(cmd, cwd);
  if (verdict.block) { process.stderr.write(`agent-vps guard: BLOCKED. ${verdict.block}\n`); process.exit(2); }
  if (verdict.warn) process.stdout.write(`agent-vps guard: ${verdict.warn}\n`);
  process.exit(0);
});

// Split a command line into simple commands (on ; && || | and newlines), each with its leading VAR=value
// assignments removed, so `echo gh pr merge` is not a merge and `FOO=1 claude -p x` still is a headless run.
function segments(cmd) {
  return cmd.split(/\n|;|&&|\|\||\|/).map((seg) => {
    const env = [];
    let rest = seg.trim().replace(/^[({\s]+/, "");
    for (let m; (m = rest.match(/^([A-Za-z_][A-Za-z0-9_]*)=("[^"]*"|'[^']*'|\S*)\s*/)); rest = rest.slice(m[0].length)) env.push(m[1]);
    return { env, argv: rest.split(/\s+/).filter(Boolean), text: rest };
  }).filter((s) => s.argv.length);
}
const withoutGlobalOpts = (argv, takesValue) => {
  const out = [argv[0]];
  for (let i = 1; i < argv.length; i++) {
    if (takesValue.includes(argv[i])) { i++; continue; }
    if (/^-/.test(argv[i]) && out.length === 1) continue;
    out.push(...argv.slice(i)); break;
  }
  return out;
};

function check(cmd, cwd) {
  const inRuntime = (p) => cfg.runtimeDirs.some((d) => p === d || p.startsWith(d + "/"));
  // Shell writes into the runtime checkout (a redirect, tee, cp/mv/rm/sed -i targeting it).
  for (const d of cfg.runtimeDirs) {
    const esc = d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(>>?|\\btee\\b[^|;&]*|\\b(cp|mv|rm|ln|install|rsync)\\b[^|;&]*|\\bsed\\s+-i\\S*[^|;&]*)\\s*${esc}(/|\\s|$)`).test(cmd)) {
      return { block: `That writes into the runtime checkout ${d} (AGENTS.md rule 1). Change it in a worktree, merge, then deploy by pull.` };
    }
  }
  for (const seg of segments(cmd)) {
    const a = seg.argv;
    // Follow `cd` within the command line: `cd /srv/runtime/app && git commit` runs in the runtime.
    if (a[0] === "cd" && a[1]) { cwd = a[1].startsWith("/") ? a[1] : require("path").resolve(cwd, a[1]); continue; }
    // Rule 3: the author never merges (any flag order, -R/--repo before the subcommand, or the REST merge endpoint).
    if (a[0] === "gh") {
      const g = withoutGlobalOpts(a, ["-R", "--repo", "--hostname"]);
      if (g[1] === "pr" && g[2] === "merge") return { block: "Never merge your own PR (AGENTS.md rule 3). Open a ready PR and let the review bot merge it." };
      if (g[1] === "api" && /\/pulls\/\d+\/merge\b/.test(seg.text)) return { block: "Never merge your own PR (AGENTS.md rule 3), including through the API." };
    }
    // Rule 4: headless Claude on the shared rotating login, -p/--print anywhere in its arguments.
    if (!cfg.allowHeadlessClaude && a[0] === "claude" && a.some((t) => t === "-p" || t === "--print") && !seg.env.includes("CLAUDE_CODE_OAUTH_TOKEN")) {
      return { block: "Headless `claude -p` on the shared login can rotate its refresh token and log out every session on the box (incidents/01). Pass your own CLAUDE_CODE_OAUTH_TOKEN setup-token to this process." };
    }
    // Rule 1: inside the runtime checkout git only fetches, reads, and fast-forwards main.
    const gitDir = a[0] === "git" && a[1] === "-C" ? a[2] : cwd;
    if (a[0] === "git" && inRuntime(gitDir)) {
      const g = a[1] === "-C" ? a.slice(3) : a.slice(1);
      const sub = g[0];
      const readOnly = ["status", "log", "diff", "show", "fetch", "rev-parse", "rev-list", "ls-files", "ls-remote", "remote", "describe", "blame", "grep"];
      const branchRead = sub === "branch" && g.slice(1).every((t) => /^-(-list|-show-current|a|r|v|vv|-all|-remotes|-contains)$/.test(t) || t === "--format" || /^--format=/.test(t));
      const pullOk = sub === "pull" && g.includes("--ff-only") && g.filter((t) => !t.startsWith("-")).slice(1).join(" ") === "origin main";
      if (!(readOnly.includes(sub) || branchRead || pullOk)) {
        return { block: `\`git ${sub}\` in the runtime checkout (AGENTS.md rule 1). Runtime moves only by \`git pull --ff-only origin main\`; do everything else in a worktree under /srv/work.` };
      }
    }
  }
  for (const p of cfg.prodPatterns) {
    if (new RegExp(p, "i").test(cmd)) return { warn: `this command matches a production pattern (${p}). Is this read-only, and is it the right target?` };
  }
  return {};
}

module.exports = { check };
