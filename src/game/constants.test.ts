import { describe, expect, it } from "vitest";

import {
  DEFAULT_GAME_HEIGHT,
  DEFAULT_GAME_WIDTH,
  GAMEPLAY,
} from "./constants";

describe("game requirements", () => {
  it("keeps fallback dimensions only for non-browser simulation contexts", () => {
    expect(DEFAULT_GAME_WIDTH).toBeGreaterThan(0);
    expect(DEFAULT_GAME_HEIGHT).toBeGreaterThan(0);
  });

  it("keeps the player hitbox smaller than rectangular attack silhouettes", () => {
    expect(GAMEPLAY.playerRadius * 2).toBeLessThan(
      GAMEPLAY.toolCallHitboxHeight,
    );
    expect(GAMEPLAY.playerRadius * 2).toBeLessThan(
      GAMEPLAY.approvalGateThickness,
    );
    expect(GAMEPLAY.maxProjectiles).toBe(56);
    expect(GAMEPLAY.playerSpeed).toBeGreaterThan(0);
  });

  it("telegraphs every projectile family before it becomes lethal", () => {
    expect(GAMEPLAY.toolCallTelegraphMs).toBeGreaterThan(0);
    expect(GAMEPLAY.approvalGateTelegraphMs).toBeGreaterThan(
      GAMEPLAY.toolCallTelegraphMs,
    );
    expect(GAMEPLAY.reasoningTelegraphMs).toBeGreaterThan(
      GAMEPLAY.approvalGateTelegraphMs,
    );
  });
});
