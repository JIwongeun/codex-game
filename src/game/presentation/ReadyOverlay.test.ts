import { describe, expect, it } from "vitest";

import { createGameState, startRun } from "../core/simulation";
import { createAmbientPath, startScreenView } from "./ReadyOverlay";

describe("createAmbientPath", () => {
  it("moves a signal from one viewport edge to the opposite edge", () => {
    const values = [0, 0.5, 0.5, 0, 0];
    const path = createAmbientPath(() => values.shift() ?? 0, 1_000, 1_000);

    expect(path).toEqual({
      startX: -18,
      startY: 50,
      endX: 112,
      endY: 50,
      angleDeg: 0,
      durationSeconds: 34,
      delaySeconds: 0,
    });
  });
});

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
    state.lastHitSource = "agent";

    expect(startScreenView(state, 18_900)).toEqual({
      visible: true,
      best: "00:18.90",
      lastRun: "00:12.34 / PARALLEL AGENT",
      actionSuffix: "TO START NEW RUN",
    });
  });
});
