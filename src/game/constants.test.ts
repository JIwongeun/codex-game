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

  it("keeps the native-pointer hitbox smaller than attack silhouettes", () => {
    expect(GAMEPLAY.playerRadius).toBeLessThan(GAMEPLAY.projectileRadius);
    expect(GAMEPLAY.playerRadius).toBeLessThan(GAMEPLAY.popupRadius);
    expect(GAMEPLAY.maxProjectiles).toBeGreaterThan(100);
  });

  it("telegraphs every projectile family before it becomes lethal", () => {
    expect(GAMEPLAY.tabTelegraphMs).toBeGreaterThan(0);
    expect(GAMEPLAY.popupTelegraphMs).toBeGreaterThan(
      GAMEPLAY.tabTelegraphMs,
    );
  });
});
