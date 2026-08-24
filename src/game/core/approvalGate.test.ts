import { describe, expect, it } from "vitest";

import { GAMEPLAY } from "../constants";
import {
  approvalGateGapSize,
  approvalGateLabelPlacement,
  approvalGateLabelText,
} from "./approvalGate";
import type { ApprovalGateState, ArenaBounds } from "./model";

const arena: ArenaBounds = { width: 2_560, height: 1_440 };

function gate(direction: { x: number; y: number }): ApprovalGateState {
  return {
    id: 1,
    position: { x: 640, y: 360 },
    direction,
    gaps: [{ center: 720, size: 138, label: "ALLOW ONCE" }],
    thickness: GAMEPLAY.approvalGateThickness,
    speed: 320,
    telegraphRemainingMs: 0,
  };
}

describe("approval gate presentation contract", () => {
  it("sizes each opening from its complete rendered sentence", () => {
    expect(approvalGateGapSize("DENY")).toBe(94);
    expect(approvalGateGapSize("REVIEW")).toBe(103);
    expect(approvalGateGapSize("ALLOW ONCE")).toBe(138);
    expect(approvalGateGapSize("ALLOW SESSION")).toBe(153);
    expect(approvalGateLabelText("ALLOW SESSION")).toBe(
      "[approval] ALLOW SESSION",
    );
  });

  it("centers a vertical-wall label in the opening and on the wall", () => {
    const approval = gate({ x: 1, y: 0 });
    const placement = approvalGateLabelPlacement(
      approval,
      approval.gaps[0]!,
      arena,
    );

    expect(placement.position).toEqual({ x: 640, y: 720 });
    expect(placement.rotation).toBe(-Math.PI / 2);
  });

  it("centers a horizontal-wall label in the opening and on the wall", () => {
    const approval = gate({ x: 0, y: 1 });
    const placement = approvalGateLabelPlacement(
      approval,
      approval.gaps[0]!,
      arena,
    );

    expect(placement.position).toEqual({ x: 720, y: 360 });
    expect(placement.rotation).toBe(0);
  });
});
