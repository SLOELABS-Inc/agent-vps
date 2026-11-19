#!/usr/bin/env node
// Installs guards/bash-guard.cjs as a Claude Code PreToolUse hook (idempotent), then self-tests it.
//   node guards/install.mjs           install + self-test
//   node guards/install.mjs --check   self-test only
// Pulling this repo does NOT update an installed guard: re-run this after pulling.
// Codex has no hook system: for Codex the same rules live in AGENTS.md, and the review bot is the backstop.
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const configDir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
const hooksDir = join(configDir, "hooks");
const target = join(hooksDir, "agent-vps-guard.cjs");

if (!process.argv.includes("--check")) {
  mkdirSync(hooksDir, { recursive: true });
  copyFileSync(join(here, "bash-guard.cjs"), target);
  const cfg = join(hooksDir, "agent-vps-guard.config.json");
  if (!existsSync(cfg)) copyFileSync(join(here, "config.example.json"), cfg);
  const settingsPath = join(configDir, "settings.json");
  const settings = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, "utf8")) : {};
  settings.hooks ??= {};
  settings.hooks.PreToolUse ??= [];
  const entry = { matcher: "Bash", hooks: [{ type: "command", command: `node ${target}` }] };
  const i = settings.hooks.PreToolUse.findIndex((e) => JSON.stringify(e).includes("agent-vps-guard.cjs"));
  if (i >= 0) settings.hooks.PreToolUse[i] = entry; else settings.hooks.PreToolUse.push(entry);
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  console.log(`installed ${target} and registered it in ${settingsPath}`);
}

// Self-test: each case runs the INSTALLED hook the way Claude Code does (JSON on stdin), checking the exit code.
const cases = [
  ["gh pr merge 12 --squash", "/srv/work/app-x", 2],
  ["gh pr merge --auto 12", "/srv/work/app-x", 2],
  ["gh api -X PUT repos/o/r/pulls/12/merge", "/srv/work/app-x", 2],
  ["git commit -m hotfix", "/srv/runtime/app", 2],
  ["git stash -u", "/srv/runtime/app", 2],
  ["git clean -fdx", "/srv/runtime/app", 2],
  ["git pull origin main", "/srv/runtime/app", 2],
  ["git pull --ff-only origin main", "/srv/runtime/app", 0],
  ["git commit -m feat", "/srv/work/app-x", 0],
  ["claude -p 'summarise'", "/srv/work/app-x", 2],
  ["CLAUDE_CODE_OAUTH_TOKEN=$MY_TOKEN claude -p 'summarise'", "/srv/work/app-x", 0],
  ["ls -la", "/srv/runtime/app", 0],
  // Found by the side-by-side review: these slipped past the first version.
  ["echo x > /srv/runtime/app/a", "/tmp", 2],
  ["git switch main", "/srv/runtime/app", 2],
  ["git pull --ff-only origin feature", "/srv/runtime/app", 2],
  ["claude --verbose -p hi", "/tmp", 2],
  ["gh -R o/r pr merge 12", "/tmp", 2],
  ["cd /srv/runtime/app && git commit -am x", "/tmp", 2],
  ["git -C /srv/runtime/app checkout -b hotfix", "/tmp", 2],
  ["FOO=1 claude -p hi", "/tmp", 2],
  // ...and these were wrongly blocked.
  ["echo gh pr merge 12", "/tmp", 0],
  ["git branch --list", "/srv/runtime/app", 0],
  ["git branch --show-current", "/srv/runtime/app", 0],
  ["cat /srv/runtime/app/README.md", "/tmp", 0],
];
const hook = process.argv.includes("--check") ? join(here, "bash-guard.cjs") : target;
console.log(`self-test runs ${hook}`);
let failed = 0;
for (const [command, cwd, want] of cases) {
  const r = spawnSync(process.execPath, [hook], { input: JSON.stringify({ tool_name: "Bash", tool_input: { command }, cwd }) });
  const ok = r.status === want;
  if (r.error || r.status === null) console.error(`could not run the hook: ${r.error?.message ?? r.signal}`);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} exit ${r.status} (want ${want})  ${cwd}$ ${command}`);
}
if (failed) { console.error(`${failed} guard self-test case(s) failed`); process.exit(1); }
console.log("guard self-test passed");
