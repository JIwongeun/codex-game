import type {
  ApprovalGateState,
  ArenaBounds,
  RectangleHitbox,
  Vec2,
} from "./model";

export interface ApprovalGateSegment {
  position: Vec2;
  hitbox: RectangleHitbox;
}

export function approvalGateSegments(
  gate: ApprovalGateState,
  arena: ArenaBounds,
): ApprovalGateSegment[] {
  const horizontalMovement = Math.abs(gate.direction.x) > 0;
  const axisSize = horizontalMovement ? arena.height : arena.width;
  const intervals = gate.gaps
    .map((gap) => ({
      start: clamp(gap.center - gap.size / 2, 0, axisSize),
      end: clamp(gap.center + gap.size / 2, 0, axisSize),
    }))
    .sort((left, right) => left.start - right.start);
  const segments: ApprovalGateSegment[] = [];
  let segmentStart = 0;

  for (const interval of intervals) {
    if (interval.start > segmentStart) {
      segments.push(
        createSegment(gate, horizontalMovement, segmentStart, interval.start),
      );
    }
    segmentStart = Math.max(segmentStart, interval.end);
  }

  if (segmentStart < axisSize) {
    segments.push(
      createSegment(gate, horizontalMovement, segmentStart, axisSize),
    );
  }

  return segments;
}

function createSegment(
  gate: ApprovalGateState,
  horizontalMovement: boolean,
  start: number,
  end: number,
): ApprovalGateSegment {
  const length = Math.max(0, end - start);
  const center = start + length / 2;
  return horizontalMovement
    ? {
        position: { x: gate.position.x, y: center },
        hitbox: { width: gate.thickness, height: length },
      }
    : {
        position: { x: center, y: gate.position.y },
        hitbox: { width: length, height: gate.thickness },
      };
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
