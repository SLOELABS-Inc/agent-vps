# 04. 218 test files that tested nothing

**What happened.** An app had 299 unit-test files. 218 of them read the source file as text and asserted that a
string was in it (`readFileSync(...)` then `toContain('someFunctionName')`).

They went red when someone renamed a variable, and stayed green while the feature they "covered" was broken. Three of
them failed on one harmless rename in a single session, and caught nothing. We deleted 103 files, about 14,000 lines,
in one pass.

**Cause (our reading).** Tests written after the code tend to restate the implementation instead of what the code
must do, and "check the source contains X" is the cheapest such test to write.

**What changed.**
- E2E first: hit the real endpoint, check the real state, leave an artifact a human can open.
- A unit test only for things that must be exact in isolation (permissions, money, dates), with the failure modes
  written down *before* the code.
- Banned: tests that grep source, tests that copy the function they test.

**Rule.** AGENTS.md "Testing".
