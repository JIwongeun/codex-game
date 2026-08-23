import { describe, expect, it, vi } from "vitest";

import { FocusPauseController } from "./FocusPauseController";

function harness(): {
  controller: FocusPauseController;
  resetClock: ReturnType<typeof vi.fn>;
  resetInput: ReturnType<typeof vi.fn>;
} {
  const resetClock = vi.fn();
  const resetInput = vi.fn();
  const controller = new FocusPauseController(
    { reset: resetClock },
    { resetForSuspend: resetInput },
  );

  return { controller, resetClock, resetInput };
}

describe("FocusPauseController", () => {
  it("freezes only an active run and clears held input immediately", () => {
    const { controller, resetClock, resetInput } = harness();

    controller.suspend("ready");
    expect(controller.isPaused).toBe(false);

    controller.suspend("playing");
    expect(controller.isPaused).toBe(true);
    expect(resetClock).toHaveBeenCalledTimes(2);
    expect(resetInput).toHaveBeenCalledTimes(2);
  });

  it("keeps the run paused after focus until an explicit resume", () => {
    const { controller, resetClock, resetInput } = harness();

    controller.suspend("playing");
    controller.focus();

    expect(controller.isPaused).toBe(true);
    expect(resetClock).toHaveBeenCalledTimes(2);
    expect(resetInput).toHaveBeenCalledTimes(2);

    expect(controller.resume()).toBe(true);
    expect(controller.isPaused).toBe(false);
    expect(resetClock).toHaveBeenCalledTimes(3);
    expect(resetInput).toHaveBeenCalledTimes(3);
    expect(controller.resume()).toBe(false);
  });
});
