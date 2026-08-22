import { describe, expect, it, vi } from "vitest";

import {
  FIXED_STEP_MS,
  MAX_FRAME_DELTA_MS,
  MAX_STEPS_PER_FRAME,
} from "../constants";
import { FixedStepRunner } from "./FixedStepRunner";

describe("FixedStepRunner", () => {
  it("accumulates short render frames into fixed simulation steps", () => {
    const runner = new FixedStepRunner();
    const step = vi.fn();

    expect(runner.advance(FIXED_STEP_MS / 2, step)).toBe(0);
    expect(runner.advance(FIXED_STEP_MS / 2, step)).toBe(1);
    expect(step).toHaveBeenCalledTimes(1);
  });

  it("caps a long frame and drops excess backlog", () => {
    const runner = new FixedStepRunner();
    const step = vi.fn();

    expect(runner.advance(MAX_FRAME_DELTA_MS * 10, step)).toBe(
      MAX_STEPS_PER_FRAME,
    );
    expect(step).toHaveBeenCalledTimes(MAX_STEPS_PER_FRAME);
    expect(runner.advance(0, step)).toBe(0);
  });

  it("resets immediately when a run finishes inside a frame", () => {
    const runner = new FixedStepRunner();
    const step = vi.fn(() => false);

    expect(runner.advance(MAX_FRAME_DELTA_MS, step)).toBe(1);
    expect(runner.advance(0, step)).toBe(0);
  });
});
