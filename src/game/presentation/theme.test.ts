import { describe, expect, it } from "vitest";

import { RENDER_DEPTHS } from "./theme";

describe("RENDER_DEPTHS", () => {
  it("places rm blackout above every attack and below its label and player", () => {
    expect(RENDER_DEPTHS.blackout).toBeGreaterThan(RENDER_DEPTHS.world);
    expect(RENDER_DEPTHS.blackout).toBeGreaterThan(
      RENDER_DEPTHS.attackLabelMax,
    );
    expect(RENDER_DEPTHS.blackout).toBeGreaterThan(RENDER_DEPTHS.effects);
    expect(RENDER_DEPTHS.blackoutLabel).toBeGreaterThan(
      RENDER_DEPTHS.blackout,
    );
    expect(RENDER_DEPTHS.player).toBeGreaterThan(RENDER_DEPTHS.blackout);
    expect(RENDER_DEPTHS.overflowTransition).toBeGreaterThan(
      RENDER_DEPTHS.player,
    );
  });
});
