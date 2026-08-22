import {
  FIXED_STEP_MS,
  MAX_FRAME_DELTA_MS,
  MAX_STEPS_PER_FRAME,
} from "../constants";
import { clamp } from "../core/math";

export class FixedStepRunner {
  private accumulatorMs = 0;

  advance(frameDeltaMs: number, runStep: () => boolean | void): number {
    const safeDelta = Number.isFinite(frameDeltaMs)
      ? clamp(frameDeltaMs, 0, MAX_FRAME_DELTA_MS)
      : 0;
    this.accumulatorMs += safeDelta;

    let steps = 0;

    while (
      this.accumulatorMs + 0.000_001 >= FIXED_STEP_MS &&
      steps < MAX_STEPS_PER_FRAME
    ) {
      this.accumulatorMs = Math.max(0, this.accumulatorMs - FIXED_STEP_MS);
      steps += 1;

      if (runStep() === false) {
        this.reset();
        break;
      }
    }

    if (
      steps === MAX_STEPS_PER_FRAME &&
      this.accumulatorMs >= FIXED_STEP_MS
    ) {
      this.accumulatorMs %= FIXED_STEP_MS;
    }

    return steps;
  }

  reset(): void {
    this.accumulatorMs = 0;
  }
}
