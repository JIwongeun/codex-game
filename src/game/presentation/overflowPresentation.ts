import { GAMEPLAY } from "../constants";

export const OVERFLOW_TRANSITION_MS = 1_200;
export const OVERFLOW_FLASH_COUNT = 3;

export interface OverflowPresentation {
  active: boolean;
  ageMs: number;
  emergencyAlpha: number;
  frameAlpha: number;
}

export function overflowPresentationAt(
  elapsedMs: number,
): OverflowPresentation {
  const startMs = GAMEPLAY.stageDurationMs * (GAMEPLAY.maxStage - 1);
  const ageMs = Math.max(0, elapsedMs - startMs);
  const active = elapsedMs >= startMs;

  if (!active) {
    return {
      active: false,
      ageMs: 0,
      emergencyAlpha: 0,
      frameAlpha: 0,
    };
  }

  const transitionProgress = Math.min(1, ageMs / OVERFLOW_TRANSITION_MS);
  const emergencyAlpha =
    Math.sin(transitionProgress * Math.PI * OVERFLOW_FLASH_COUNT) ** 2 *
    (transitionProgress < 1 ? 0.82 : 0);
  const frameAlpha =
    0.24 + (Math.sin((ageMs / 1_200) * Math.PI * 2) + 1) * 0.08;

  return {
    active: true,
    ageMs,
    emergencyAlpha,
    frameAlpha,
  };
}
