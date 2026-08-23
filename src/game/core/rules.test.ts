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
    expect(start.contextMaxIntervalMs).toBeGreaterThan(
      middle.contextMaxIntervalMs,
    );
    expect(middle.contextMaxIntervalMs).toBeGreaterThan(
      cap.contextMaxIntervalMs,
    );
    expect(start.mergeBugIntervalMs).toBeGreaterThan(cap.mergeBugIntervalMs);
    expect(cap.progress).toBe(1);
    expect(start.stage).toBe(1);
    expect(cap.stage).toBe(10);
    expect(cap.logBurst).toBe(3);
    expect(start.contextMaxCount).toBe(1);
    expect(cap.contextMaxCount).toBe(3);
    expect(start.racePairCount).toBe(1);
    expect(cap.racePairCount).toBe(3);
    expect(cap.mergeIncomingCount).toBe(8);
    expect(cap.bugFragmentCount).toBe(20);
  });

  it("unlocks all seven semantic patterns across ten explicit stages", () => {
    expect(difficultyAt(0).reviewUnlocked).toBe(false);
    expect(difficultyAt(GAMEPLAY.reviewFirstSpawnMs).reviewUnlocked).toBe(true);
    expect(
      difficultyAt(GAMEPLAY.contextMaxFirstSpawnMs).contextMaxUnlocked,
    ).toBe(true);
    expect(
      difficultyAt(GAMEPLAY.retryLoopFirstSpawnMs).retryLoopUnlocked,
    ).toBe(true);
    expect(
      difficultyAt(GAMEPLAY.forkBombFirstSpawnMs).forkBombUnlocked,
    ).toBe(true);
    expect(
      difficultyAt(GAMEPLAY.raceConditionFirstSpawnMs).raceConditionUnlocked,
    ).toBe(true);
    expect(
      difficultyAt(GAMEPLAY.mergeBugFirstSpawnMs).mergeBugUnlocked,
    ).toBe(true);
    expect(difficultyAt(GAMEPLAY.difficultyRampMs).stage).toBe(10);
  });

  it.each([
    [0, 1],
    [GAMEPLAY.stageDurationMs - 1, 1],
    [GAMEPLAY.stageDurationMs, 2],
    [GAMEPLAY.stageDurationMs * 8, 9],
    [GAMEPLAY.stageDurationMs * 9, 10],
    [GAMEPLAY.stageDurationMs * 20, 10],
  ])("maps %i ms to stage %i", (elapsedMs, stage) => {
    expect(difficultyAt(elapsedMs).stage).toBe(stage);
  });

  it.each([
    [0, "00:00.00"],
    [12_340, "00:12.34"],
    [61_999, "01:01.99"],
  ])("formats %i ms as %s", (milliseconds, formatted) => {
    expect(formatSurvivalTime(milliseconds)).toBe(formatted);
  });
});
