import { describe, expect, it } from "vitest";

import { attackTextTokens, layoutAttackTextTokens } from "./attackText";

describe("attackTextTokens", () => {
  it("matches Codex terminal syntax roles inside one command", () => {
    expect(attackTextTokens("terminal", '$ git commit -m "fix"')).toEqual([
      { text: "$ ", role: "muted" },
      { text: "git", role: "terminalExecutable" },
      { text: " ", role: "ink" },
      { text: "commit", role: "ink" },
      { text: " ", role: "ink" },
      { text: "-m", role: "terminalParameter" },
      { text: " ", role: "ink" },
      { text: '"fix"', role: "terminalString" },
    ]);
  });

  it("keeps browser and Codex surfaces on their own syntax", () => {
    expect(attackTextTokens("browser", "404 Not Found")).toEqual([
      { text: "404", role: "browserError" },
      { text: " ", role: "ink" },
      { text: "Not", role: "ink" },
      { text: " ", role: "ink" },
      { text: "Found", role: "ink" },
    ]);
    expect(attackTextTokens("browser", "net::ERR_FAILED")).toEqual([
      { text: "net::", role: "browserMeta" },
      { text: "ERR_FAILED", role: "browserError" },
    ]);
    expect(attackTextTokens("browser", "429 Too Many Requests")[0]).toEqual({
      text: "429",
      role: "browserError",
    });
    expect(attackTextTokens("browser", "502 Bad Gateway")[0]).toEqual({
      text: "502",
      role: "browserError",
    });
    expect(attackTextTokens("codex", "[context] 84% used")).toEqual([
      { text: "[context]", role: "codexToken" },
      { text: " ", role: "ink" },
      { text: "84%", role: "codexToken" },
      { text: " ", role: "ink" },
      { text: "used", role: "ink" },
    ]);
    expect(attackTextTokens("codex", "[usage] 12% left")).toEqual([
      { text: "[usage]", role: "codexToken" },
      { text: " ", role: "ink" },
      { text: "12%", role: "codexToken" },
      { text: " ", role: "ink" },
      { text: "left", role: "ink" },
    ]);
  });

  it("recognizes compiler and filesystem error codes as terminal errors", () => {
    expect(attackTextTokens("terminal", "TS2322: not assignable")[0]).toEqual({
      text: "TS2322:",
      role: "terminalError",
    });
    expect(attackTextTokens("terminal", "ENOENT: file not found")[0]).toEqual({
      text: "ENOENT:",
      role: "terminalError",
    });
  });

  it("removes only the duplicated stroke gap after a terminal prompt", () => {
    const tokens = attackTextTokens("terminal", "$ git commit");
    const layout = layoutAttackTextTokens(
      "terminal",
      tokens,
      [10, 18, 6, 36],
      2,
    );

    expect(layout).toEqual({
      totalWidth: 66,
      offsets: [-33, -27, -9, -3],
    });
    expect(layout.offsets[2] - layout.offsets[1]).toBe(18);
    expect(layout.offsets[3] - layout.offsets[2]).toBe(6);
  });
});
