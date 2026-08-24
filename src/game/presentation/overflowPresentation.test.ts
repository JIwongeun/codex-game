import { describe, expect, it } from "vitest";

import { GAMEPLAY } from "../constants";
import {
  OVERFLOW_TRANSITION_MS,
  overflowPresentationAt,
} from "./overflowPresentation";

const STAGE_TEN_START_MS =
  GAMEPLAY.stageDurationMs * (GAMEPLAY.maxStage - 1);

describe("overflowPresentationAt", () => {
  it("stays inactive through stage nine", () => {
    expect(overflowPresentationAt(STAGE_TEN_START_MS - 1)).toEqual({
      active: false,
      ageMs: 0,
      inversionAlpha: 0,
      frameAlpha: 0,
    });
  });

  it("plays one short inversion only when stage ten begins", () => {
    const midpoint = overflowPresentationAt(
      STAGE_TEN_START_MS + OVERFLOW_TRANSITION_MS / 2,
    );
    const finished = overflowPresentationAt(
      STAGE_TEN_START_MS + OVERFLOW_TRANSITION_MS,
    );
    const late = overflowPresentationAt(STAGE_TEN_START_MS + 90_000);

    expect(midpoint.active).toBe(true);
    expect(midpoint.inversionAlpha).toBeCloseTo(0.92);
    expect(finished.inversionAlpha).toBe(0);
    expect(late.inversionAlpha).toBe(0);
  });

  it("keeps the persistent border pulse subtle", () => {
    const samples = [0, 300, 600, 900, 1_200].map(
      (offset) =>
        overflowPresentationAt(STAGE_TEN_START_MS + offset).frameAlpha,
    );

    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0.24);
    expect(Math.max(...samples)).toBeLessThanOrEqual(0.4);
  });
});
