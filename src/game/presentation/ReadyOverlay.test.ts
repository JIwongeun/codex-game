import { describe, expect, it } from "vitest";

import { createGameState, startRun } from "../core/simulation";
import { startScreenView } from "./ReadyOverlay";

describe("startScreenView", () => {
  it("uses the same start surface before the first run and after game over", () => {
    const state = createGameState(17, 960, 640);

    expect(startScreenView(state, 0)).toEqual({
      visible: true,
      best: "00:00.00",
      lastRun: "--:--.-- / NO RUN YET",
      actionSuffix: "TO START RUN",
    });

    startRun(state);
    expect(startScreenView(state, 0).visible).toBe(false);

    state.phase = "results";
    state.elapsedMs = 12_340;
    state.lastHitSource = "race";

    expect(startScreenView(state, 18_900)).toEqual({
      visible: true,
      best: "00:18.90",
      lastRun: "00:12.34 / RACE CONDITION",
      actionSuffix: "TO START NEW RUN",
    });
  });
});
