import { GAMEPLAY } from "../constants";
import { distanceSquared } from "../core/math";
import type { Vec2 } from "../core/model";

interface PauseResumeAction {
  source: "pointer" | "keyboard";
  position: Vec2 | null;
}

export function canResumeFromPause(
  anchor: Vec2,
  action: PauseResumeAction | null,
): boolean {
  if (action?.source !== "pointer" || action.position === null) {
    return false;
  }

  return (
    distanceSquared(anchor, action.position) <=
    GAMEPLAY.pauseResumeRadius * GAMEPLAY.pauseResumeRadius
  );
}
