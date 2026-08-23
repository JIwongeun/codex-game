import { describe, expect, it } from "vitest";

import { GAMEPLAY } from "../constants";
import { difficultyAt, formatSurvivalTime } from "./rules";

describe("survival rules", () => {
  it("raises pressure monotonically and caps the deterministic ramp", () => {
    const start = difficultyAt(0);
    const middle = difficultyAt(GAMEPLAY.difficultyRampMs / 2);
    const cap = difficultyAt(GAMEPLAY.difficultyRampMs * 2);

    expect(start.logSpeed).toBeLessThan(middle.logSpeed);
    expect(middle.logSpeed).toBeLessThan(cap.logSpeed);
    expect(start.logIntervalMs).toBeGreaterThan(middle.logIntervalMs);
    expect(middle.logIntervalMs).toBeGreaterThan(cap.logIntervalMs);
    expect(cap.progress).toBe(1);
    expect(cap.logBurst).toBe(4);
  });

  it("unlocks stronger developer-parody attacks in explicit stages", () => {
    expect(difficultyAt(0).reviewUnlocked).toBe(false);
    expect(difficultyAt(GAMEPLAY.reviewFirstSpawnMs).reviewUnlocked).toBe(true);
    expect(
      difficultyAt(GAMEPLAY.contextMaxFirstSpawnMs).contextMaxUnlocked,
    ).toBe(true);
    expect(
      difficultyAt(GAMEPLAY.mergeConflictFirstSpawnMs).mergeConflictUnlocked,
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
