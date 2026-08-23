import type { RectangleHitbox, Vec2 } from "./model";

const TAU = Math.PI * 2;

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function distanceSquared(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function length(vector: Vec2): number {
  return Math.hypot(vector.x, vector.y);
}

export function normalize(vector: Vec2, fallback: Vec2 = { x: 1, y: 0 }): Vec2 {
  const magnitude = length(vector);

  if (magnitude < Number.EPSILON) {
    return { ...fallback };
  }

  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
  };
}

export function directionBetween(from: Vec2, to: Vec2): Vec2 {
  return normalize({ x: to.x - from.x, y: to.y - from.y });
}

export function rotateToward(
  current: Vec2,
  target: Vec2,
  maximumRadians: number,
): Vec2 {
  const currentAngle = Math.atan2(current.y, current.x);
  const targetAngle = Math.atan2(target.y, target.x);
  let difference = ((targetAngle - currentAngle + Math.PI) % TAU) - Math.PI;

  if (difference < -Math.PI) {
    difference += TAU;
  }

  const nextAngle = currentAngle + clamp(difference, -maximumRadians, maximumRadians);
  return { x: Math.cos(nextAngle), y: Math.sin(nextAngle) };
}

export function circlesOverlap(
  first: Vec2,
  firstRadius: number,
  second: Vec2,
  secondRadius: number,
): boolean {
  const combinedRadius = firstRadius + secondRadius;
  return distanceSquared(first, second) <= combinedRadius * combinedRadius;
}

export function circleOverlapsRectangle(
  circleCenter: Vec2,
  circleRadius: number,
  rectangleCenter: Vec2,
  rectangle: RectangleHitbox,
): boolean {
  const halfWidth = rectangle.width / 2;
  const halfHeight = rectangle.height / 2;
  const nearestX = clamp(
    circleCenter.x,
    rectangleCenter.x - halfWidth,
    rectangleCenter.x + halfWidth,
  );
  const nearestY = clamp(
    circleCenter.y,
    rectangleCenter.y - halfHeight,
    rectangleCenter.y + halfHeight,
  );

  return (
    distanceSquared(circleCenter, { x: nearestX, y: nearestY }) <=
    circleRadius * circleRadius
  );
}

export function wrap(value: number, minimum: number, maximum: number): number {
  const range = maximum - minimum;
  return ((((value - minimum) % range) + range) % range) + minimum;
}
