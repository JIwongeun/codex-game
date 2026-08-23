import { describe, expect, it } from "vitest";

import { GAMEPLAY } from "../constants";
import { canResumeFromPause } from "./pauseResume";

const anchor = { x: 100, y: 80 };

describe("pause resume gate", () => {
  it("accepts a pointer click returned to the frozen cursor", () => {
    expect(
      canResumeFromPause(anchor, {
        source: "pointer",
        position: { x: 100 + GAMEPLAY.pauseResumeRadius, y: 80 },
      }),
    ).toBe(true);
  });

  it("rejects a pointer click away from the frozen cursor", () => {
    expect(
      canResumeFromPause(anchor, {
        source: "pointer",
        position: { x: 100 + GAMEPLAY.pauseResumeRadius + 1, y: 80 },
      }),
    ).toBe(false);
  });

  it("rejects keyboard resume and missing actions", () => {
    expect(
      canResumeFromPause(anchor, { source: "keyboard", position: anchor }),
    ).toBe(false);
    expect(canResumeFromPause(anchor, null)).toBe(false);
  });
});
