import { describe, expect, it } from "vitest";

import {
  simulatedContextLoadK,
  stageDisplayLabel,
} from "./stagePresentation";

describe("stage presentation", () => {
  it("doubles the fictional context load at every stage", () => {
    expect(
      Array.from({ length: 10 }, (_, index) =>
        simulatedContextLoadK(index + 1),
      ),
    ).toEqual([1, 2, 4, 8, 16, 32, 64, 128, 256, 512]);
  });

  it("keeps regular stages readable and marks stage ten as overflow", () => {
    expect(stageDisplayLabel(1)).toBe("STAGE 01  ·  1K");
    expect(stageDisplayLabel(9)).toBe("STAGE 09  ·  256K");
    expect(stageDisplayLabel(10)).toBe(
      "STAGE 10  ·  512K // OVERFLOW",
    );
  });

  it("clamps display input to the supported stage range", () => {
    expect(stageDisplayLabel(0)).toBe("STAGE 01  ·  1K");
    expect(stageDisplayLabel(999)).toBe(
      "STAGE 10  ·  512K // OVERFLOW",
    );
  });
});
