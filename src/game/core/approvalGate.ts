import type {
  ApprovalGateState,
  ArenaBounds,
  RectangleHitbox,
  Vec2,
} from "./model";

export interface ApprovalGateSegment {
  position: Vec2;
  hitbox: RectangleHitbox;
  label: "ALLOW ONCE" | "ALLOW SESSION";
}

export function approvalGateSegments(
  gate: ApprovalGateState,
  arena: ArenaBounds,
): readonly [ApprovalGateSegment, ApprovalGateSegment] {
  if (Math.abs(gate.direction.x) > 0) {
    const gapStart = clamp(gate.gapCenter - gate.gapSize / 2, 0, arena.height);
    const gapEnd = clamp(gate.gapCenter + gate.gapSize / 2, 0, arena.height);
    return [
      {
        position: { x: gate.position.x, y: gapStart / 2 },
        hitbox: { width: gate.thickness, height: gapStart },
        label: "ALLOW ONCE",
      },
      {
        position: {
          x: gate.position.x,
          y: gapEnd + (arena.height - gapEnd) / 2,
        },
        hitbox: {
          width: gate.thickness,
          height: arena.height - gapEnd,
        },
        label: "ALLOW SESSION",
      },
    ];
  }

  const gapStart = clamp(gate.gapCenter - gate.gapSize / 2, 0, arena.width);
  const gapEnd = clamp(gate.gapCenter + gate.gapSize / 2, 0, arena.width);
  return [
    {
      position: { x: gapStart / 2, y: gate.position.y },
      hitbox: { width: gapStart, height: gate.thickness },
      label: "ALLOW ONCE",
    },
    {
      position: {
        x: gapEnd + (arena.width - gapEnd) / 2,
        y: gate.position.y,
      },
      hitbox: {
        width: arena.width - gapEnd,
        height: gate.thickness,
      },
      label: "ALLOW SESSION",
    },
  ];
}

export function approvalGateDisplayPosition(
  gate: ApprovalGateState,
  arena: ArenaBounds,
): Vec2 {
  if (gate.telegraphRemainingMs <= 0) {
    return gate.position;
  }
  if (gate.direction.x > 0) {
    return { x: gate.thickness / 2, y: gate.position.y };
  }
  if (gate.direction.x < 0) {
    return { x: arena.width - gate.thickness / 2, y: gate.position.y };
  }
  if (gate.direction.y > 0) {
    return { x: gate.position.x, y: gate.thickness / 2 };
  }
  return { x: gate.position.x, y: arena.height - gate.thickness / 2 };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
