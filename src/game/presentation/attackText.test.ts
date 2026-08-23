import { describe, expect, it } from "vitest";

import { attackTextTokens } from "./attackText";

describe("attackTextTokens", () => {
  it("matches Codex terminal syntax roles inside one command", () => {
    expect(attackTextTokens("terminal", '$ git commit -m "fix"')).toEqual([
      { text: "$", role: "muted" },
      { text: " ", role: "ink" },
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
    expect(attackTextTokens("codex", "[context] 84% used")).toEqual([
      { text: "[context]", role: "codexToken" },
      { text: " ", role: "ink" },
      { text: "84%", role: "codexToken" },
      { text: " ", role: "ink" },
      { text: "used", role: "ink" },
    ]);
  });
});
