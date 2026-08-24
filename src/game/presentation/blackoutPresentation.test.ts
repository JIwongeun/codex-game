import { describe, expect, it } from "vitest";

import { GAMEPLAY } from "../constants";
import type { BlackoutState } from "../core/model";
import {
  blackoutVisualState,
  pointInsideVisibleBlackout,
} from "./blackoutPresentation";

function blackout(overrides: Partial<BlackoutState> = {}): BlackoutState {
  return {
    id: 1,
    position: { x: 200, y: 200 },
    hitbox: { width: 400, height: 400 },
    telegraphRemainingMs: 0,
    remainingMs: GAMEPLAY.blackoutStageTenDurationMs,
    durationMs: GAMEPLAY.blackoutStageTenDurationMs,
    ...overrides,
  };
}

describe("blackout presentation", () => {
  it("fills backup to 100% before folding the square away", () => {
    const durationMs = GAMEPLAY.blackoutStageTenDurationMs;
    const start = blackoutVisualState(blackout());
    const recoveryStart = blackoutVisualState(
      blackout({ remainingMs: GAMEPLAY.blackoutRecoveryMs }),
    );
    const recoveryMiddle = blackoutVisualState(
      blackout({ remainingMs: GAMEPLAY.blackoutRecoveryMs / 2 }),
    );
    const end = blackoutVisualState(blackout({ remainingMs: 0 }));

    expect(start).toEqual({ backupProgress: 0, recovering: false, scale: 1 });
    expect(recoveryStart.backupProgress).toBe(1);
    expect(recoveryStart.scale).toBe(1);
    expect(recoveryMiddle.recovering).toBe(true);
    expect(recoveryMiddle.scale).toBeCloseTo(0.75);
    expect(end).toEqual({ backupProgress: 1, recovering: true, scale: 0 });
    expect(durationMs).toBeGreaterThan(GAMEPLAY.blackoutRecoveryMs);
  });

  it("keeps the player readable only inside the currently visible square", () => {
    expect(pointInsideVisibleBlackout(blackout(), { x: 350, y: 200 })).toBe(
      true,
    );
    expect(
      pointInsideVisibleBlackout(
        blackout({ remainingMs: GAMEPLAY.blackoutRecoveryMs / 2 }),
        { x: 360, y: 200 },
      ),
    ).toBe(false);
    expect(
      pointInsideVisibleBlackout(
        blackout({ telegraphRemainingMs: 1 }),
        { x: 200, y: 200 },
      ),
    ).toBe(false);
  });
});
