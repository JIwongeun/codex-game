import { describe, expect, it } from "vitest";

import { GAME_HEIGHT, GAME_WIDTH, GAMEPLAY } from "./constants";

describe("game requirements", () => {
  it("uses the submission-oriented 16:9 logical canvas", () => {
    expect(GAME_WIDTH / GAME_HEIGHT).toBeCloseTo(16 / 9);
  });

  it("keeps the pointer hitbox smaller than incoming attack silhouettes", () => {
    expect(GAMEPLAY.playerRadius).toBeLessThan(GAMEPLAY.projectileRadius * 2);
    expect(GAMEPLAY.maxProjectiles).toBeGreaterThan(100);
  });
});
