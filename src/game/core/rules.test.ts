import { describe, expect, it } from "vitest";

import { GAMEPLAY } from "../constants";
import { difficultyAt, formatSurvivalTime } from "./rules";

describe("survival rules", () => {
  it("raises pressure monotonically and caps the deterministic ramp", () => {
    const start = difficultyAt(0);
    const middle = difficultyAt(GAMEPLAY.difficultyRampMs / 2);
    const cap = difficultyAt(GAMEPLAY.difficultyRampMs * 2);

    expect(start.toolCallSpeed).toBeLessThan(middle.toolCallSpeed);
    expect(middle.toolCallSpeed).toBeLessThan(cap.toolCallSpeed);
    expect(start.toolCallIntervalMs).toBeGreaterThan(middle.toolCallIntervalMs);
    expect(middle.toolCallIntervalMs).toBeGreaterThan(cap.toolCallIntervalMs);
    expect(start.compactionIntervalMs).toBeGreaterThan(
      middle.compactionIntervalMs,
    );
    expect(middle.compactionIntervalMs).toBeGreaterThan(
      cap.compactionIntervalMs,
    );
    expect(start.usageLimitIntervalMs).toBeGreaterThan(
      cap.usageLimitIntervalMs,
    );
    expect(cap.progress).toBe(1);
    expect(start.stage).toBe(1);
    expect(cap.stage).toBe(10);
    expect(cap.toolCallBurst).toBe(3);
    expect(start.compactionCount).toBe(1);
    expect(cap.compactionCount).toBe(3);
    expect(start.compactionSize).toBe(255);
    expect(cap.compactionSize).toBe(375);
    expect(start.compactionFragmentCount).toBe(12);
    expect(cap.compactionFragmentCount).toBe(20);
    expect(start.compactionFragmentSpeed).toBeLessThan(
      cap.compactionFragmentSpeed,
    );
    expect(start.parallelAgentPairs).toBe(1);
    expect(cap.parallelAgentPairs).toBe(3);
    expect(cap.usageDrainCount).toBe(8);
    expect(cap.limitFragmentCount).toBe(20);
  });

  it("unlocks all eight Codex patterns across ten explicit stages", () => {
    expect(difficultyAt(0).approvalUnlocked).toBe(false);
    expect(difficultyAt(GAMEPLAY.approvalFirstSpawnMs).approvalUnlocked).toBe(
      true,
    );
    expect(
      difficultyAt(GAMEPLAY.compactionFirstSpawnMs).compactionUnlocked,
    ).toBe(true);
    expect(
      difficultyAt(GAMEPLAY.retryLoopFirstSpawnMs).retryLoopUnlocked,
    ).toBe(true);
    expect(
      difficultyAt(GAMEPLAY.reasoningFirstSpawnMs).reasoningUnlocked,
    ).toBe(true);
    expect(
      difficultyAt(GAMEPLAY.parallelAgentsFirstSpawnMs).parallelAgentsUnlocked,
    ).toBe(true);
    expect(
      difficultyAt(GAMEPLAY.reviewLoopFirstSpawnMs).reviewLoopUnlocked,
    ).toBe(true);
    expect(
      difficultyAt(GAMEPLAY.usageLimitFirstSpawnMs).usageLimitUnlocked,
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
