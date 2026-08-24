import { GAMEPLAY } from "../constants";
import type { BlackoutState, Vec2 } from "../core/model";

export interface BlackoutVisualState {
  backupProgress: number;
  recovering: boolean;
  scale: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function blackoutVisualState(
  blackout: BlackoutState,
): BlackoutVisualState {
  if (blackout.telegraphRemainingMs > 0) {
    return { backupProgress: 0, recovering: false, scale: 1 };
  }

  const backupDurationMs = Math.max(
    1,
    blackout.durationMs - GAMEPLAY.blackoutRecoveryMs,
  );
  const activeElapsedMs = blackout.durationMs - blackout.remainingMs;
  const backupProgress = clamp01(activeElapsedMs / backupDurationMs);
  const recoveryProgress = clamp01(
    1 - blackout.remainingMs / GAMEPLAY.blackoutRecoveryMs,
  );

  return {
    backupProgress,
    recovering: recoveryProgress > 0,
    scale: 1 - recoveryProgress * recoveryProgress,
  };
}

export function pointInsideVisibleBlackout(
  blackout: BlackoutState,
  point: Vec2,
): boolean {
  if (blackout.telegraphRemainingMs > 0) {
    return false;
  }

  const { scale } = blackoutVisualState(blackout);
  return (
    Math.abs(point.x - blackout.position.x) <=
      (blackout.hitbox.width * scale) / 2 &&
    Math.abs(point.y - blackout.position.y) <=
      (blackout.hitbox.height * scale) / 2
  );
}
