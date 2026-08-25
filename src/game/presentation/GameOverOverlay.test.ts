import { describe, expect, it } from "vitest";

import { createGameState } from "../core/simulation";
import { gameOverView } from "./GameOverOverlay";

describe("gameOverView", () => {
  it("shows the frozen run time, hit source, and session record state", () => {
    const state = createGameState(31, 960, 640);
    state.phase = "results";
    state.elapsedMs = 83_210;
    state.lastHitSource = "context-token";

    expect(gameOverView(state, true)).toEqual({
      time: "01:23.21",
      source: "LOST CONTEXT TOKEN",
      newBest: true,
    });
  });
});
