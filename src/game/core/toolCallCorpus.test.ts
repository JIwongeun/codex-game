import { describe, expect, it } from "vitest";

import { TOOL_CALL_ENTRIES } from "./toolCallCorpus";

describe("TOOL_CALL_ENTRIES", () => {
  it("provides a broad, duplicate-free mix of real work surfaces", () => {
    const signatures = TOOL_CALL_ENTRIES.map(
      ({ label, surface }) => `${surface}|${label}`,
    );
    const labels = TOOL_CALL_ENTRIES.map(({ label }) => label);
    const terminalLabels = TOOL_CALL_ENTRIES.filter(
      ({ surface }) => surface === "terminal",
    ).map(({ label }) => label);

    expect(TOOL_CALL_ENTRIES.length).toBeGreaterThanOrEqual(150);
    expect(new Set(signatures).size).toBe(signatures.length);
    expect(terminalLabels.length).toBeGreaterThanOrEqual(100);
    expect(
      TOOL_CALL_ENTRIES.filter(({ surface }) => surface === "browser").length,
    ).toBeGreaterThanOrEqual(18);
    expect(
      TOOL_CALL_ENTRIES.filter(({ surface }) => surface === "codex").length,
    ).toBeGreaterThanOrEqual(24);

    expect(terminalLabels).toEqual(
      expect.arrayContaining([
        "$ git add .",
        '$ git commit -m "fix flaky test"',
        "$ git push --force-with-lease",
        "$ npm run build",
        "$ pnpm exec vitest run",
        "$ npx tsc --noEmit",
        "$ cd src/game",
        "$ ls -la",
        "$ rm -r dist",
        "$ Get-Content package.json",
      ]),
    );

    const lengths = labels.map((label) => label.length);
    expect(lengths.filter((length) => length <= 14).length).toBeGreaterThan(10);
    expect(
      lengths.filter((length) => length >= 15 && length <= 30).length,
    ).toBeGreaterThan(60);
    expect(lengths.filter((length) => length >= 31).length).toBeGreaterThan(25);
    expect(Math.max(...lengths)).toBeLessThanOrEqual(64);
  });
});
