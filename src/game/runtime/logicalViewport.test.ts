import { describe, expect, it } from "vitest";

import {
  DEFAULT_GAME_HEIGHT,
  DEFAULT_GAME_WIDTH,
} from "../constants";
import { logicalViewportFor } from "./logicalViewport";

describe("logical viewport", () => {
  it("keeps QHD as the one-to-one gameplay reference", () => {
    expect(logicalViewportFor(2560, 1440)).toEqual({
      width: DEFAULT_GAME_WIDTH,
      height: DEFAULT_GAME_HEIGHT,
      zoom: 1,
    });
  });

  it("renders FHD with the same QHD gameplay proportions", () => {
    expect(logicalViewportFor(1920, 1080)).toEqual({
      width: DEFAULT_GAME_WIDTH,
      height: DEFAULT_GAME_HEIGHT,
      zoom: 0.75,
    });
  });

  it("preserves the viewport aspect ratio without letterboxing", () => {
    const viewport = logicalViewportFor(1600, 1200);

    expect(viewport.height).toBe(DEFAULT_GAME_HEIGHT);
    expect(viewport.width).toBe(1920);
    expect(viewport.zoom).toBeCloseTo(1200 / DEFAULT_GAME_HEIGHT);
    expect(viewport.width / viewport.height).toBeCloseTo(1600 / 1200);
  });
});
