import { describe, expect, it } from "vitest";

import {
  GAME_HEIGHT,
  GAME_WIDTH,
  RUN_DURATION_SECONDS,
  STARTING_LIVES,
} from "./constants";

describe("game requirements", () => {
  it("uses the submission-oriented 16:9 logical canvas", () => {
    expect(GAME_WIDTH / GAME_HEIGHT).toBeCloseTo(16 / 9);
  });

  it("keeps the agreed short session and approachable life count", () => {
    expect(RUN_DURATION_SECONDS).toBe(90);
    expect(STARTING_LIVES).toBe(3);
  });
});

