import { describe, expect, it } from "vitest";

import { textTextureResolution } from "./renderQuality";

describe("render quality", () => {
  it("keeps small Phaser text at a high internal resolution", () => {
    expect(textTextureResolution(1)).toBe(2);
    expect(textTextureResolution(1.25)).toBe(2);
    expect(textTextureResolution(2)).toBe(2);
  });

  it("caps extreme or invalid device pixel ratios", () => {
    expect(textTextureResolution(4)).toBe(3);
    expect(textTextureResolution(Number.NaN)).toBe(2);
    expect(textTextureResolution(0)).toBe(2);
  });
});
