import { describe, expect, it } from "vitest";

import { GAMEPLAY, RUN_DURATION_MS } from "../constants";
import {
  compactRadius,
  compactScore,
  contextRatio,
  desiredTrailPoints,
  difficultyAt,
  riskMultiplier,
  survivalBonus,
} from "./rules";

describe("game rules", () => {
  it.each([
    [0, 1],
    [5, 1],
    [6, 1.5],
    [11, 1.5],
    [12, 2],
    [17, 2],
    [18, 3],
    [23, 3],
    [24, 4],
  ])("uses an explicit risk tier at %i tokens", (tokens, multiplier) => {
    expect(riskMultiplier(tokens)).toBe(multiplier);
  });

  it("banks only clamped pending tokens", () => {
    expect(compactScore(0)).toBe(0);
    expect(compactScore(6)).toBe(900);
    expect(compactScore(24)).toBe(9_600);
    expect(compactScore(999)).toBe(9_600);
  });

  it("derives context, trail, radius, and survival rewards", () => {
    expect(contextRatio(12)).toBe(0.5);
    expect(desiredTrailPoints(12)).toBe(
      GAMEPLAY.baseTrailPoints + 12 * GAMEPLAY.trailPointsPerToken,
    );
    expect(compactRadius(24)).toBe(350);
    expect(survivalBonus(3)).toBe(1_500);
  });

  it("increases pressure monotonically and accelerates the deadline", () => {
    const start = difficultyAt(0);
    const middle = difficultyAt(RUN_DURATION_MS / 2);
    const deadline = difficultyAt(RUN_DURATION_MS - 1_000);

    expect(start.tabSpeed).toBeLessThan(middle.tabSpeed);
    expect(middle.tabSpeed).toBeLessThan(deadline.tabSpeed);
    expect(start.tabIntervalMs).toBeGreaterThan(middle.tabIntervalMs);
    expect(deadline.tabIntervalMs).toBeLessThan(middle.tabIntervalMs);
    expect(deadline.deadline).toBe(true);
  });
});
