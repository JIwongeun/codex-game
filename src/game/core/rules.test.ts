import { describe, expect, it } from "vitest";

import { GAMEPLAY } from "../constants";
import { difficultyAt, formatSurvivalTime } from "./rules";

describe("survival rules", () => {
  it("raises pressure monotonically and caps the deterministic ramp", () => {
    const start = difficultyAt(0);
    const middle = difficultyAt(GAMEPLAY.difficultyRampMs / 2);
    const cap = difficultyAt(GAMEPLAY.difficultyRampMs * 2);

    expect(start.tabSpeed).toBeLessThan(middle.tabSpeed);
    expect(middle.tabSpeed).toBeLessThan(cap.tabSpeed);
    expect(start.tabIntervalMs).toBeGreaterThan(middle.tabIntervalMs);
    expect(middle.tabIntervalMs).toBeGreaterThan(cap.tabIntervalMs);
    expect(cap.progress).toBe(1);
    expect(cap.tabBurst).toBe(4);
  });

  it("unlocks stronger browser attacks in explicit stages", () => {
    expect(difficultyAt(0).popupUnlocked).toBe(false);
    expect(difficultyAt(GAMEPLAY.popupFirstSpawnMs).popupUnlocked).toBe(true);
    expect(difficultyAt(GAMEPLAY.memoryLeakFirstSpawnMs).memoryLeakUnlocked).toBe(
      true,
    );
    expect(
      difficultyAt(GAMEPLAY.contextSweepFirstSpawnMs).contextSweepUnlocked,
    ).toBe(true);
  });

  it.each([
    [0, "00:00.00"],
    [12_340, "00:12.34"],
    [61_999, "01:01.99"],
  ])("formats %i ms as %s", (milliseconds, formatted) => {
    expect(formatSurvivalTime(milliseconds)).toBe(formatted);
  });
});
