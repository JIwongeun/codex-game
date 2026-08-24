import { describe, expect, it } from "vitest";

import { logicalViewportFor } from "./logicalViewport";
import {
  renderQualityFor,
  textTextureResolution,
} from "./renderQuality";

describe("render quality", () => {
  it("supersamples an FHD display to a 4K backing buffer", () => {
    expect(renderQualityFor(1920, 1080, 1, 1920, 1080)).toEqual({
      profile: "fhd",
      renderScale: 2,
      backingWidth: 3840,
      backingHeight: 2160,
    });
  });

  it("supersamples a QHD display to the same 4K-class backing buffer", () => {
    expect(renderQualityFor(2560, 1440, 1, 2560, 1440)).toEqual({
      profile: "qhd",
      renderScale: 1.5,
      backingWidth: 3840,
      backingHeight: 2160,
    });
  });

  it("detects scaled QHD displays from their physical resolution", () => {
    expect(renderQualityFor(2048, 1016, 1.25, 2048, 1152)).toEqual({
      profile: "qhd",
      renderScale: 1.5,
      backingWidth: 3072,
      backingHeight: 1524,
    });
  });

  it("caps large backing buffers without falling below native resolution", () => {
    expect(renderQualityFor(3440, 1440, 1, 3440, 1440)).toEqual({
      profile: "qhd",
      renderScale: 4096 / 3440,
      backingWidth: 4096,
      backingHeight: 1715,
    });
  });

  it("keeps the same logical arena visible after backing supersampling", () => {
    for (const [width, height] of [
      [1920, 1080],
      [2560, 1440],
    ] as const) {
      const logical = logicalViewportFor(width, height);
      const quality = renderQualityFor(width, height, 1, width, height);
      const cameraZoom = logical.zoom * quality.renderScale;

      expect(quality.backingWidth / cameraZoom).toBeCloseTo(logical.width);
      expect(quality.backingHeight / cameraZoom).toBeCloseTo(logical.height);
    }
  });

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
