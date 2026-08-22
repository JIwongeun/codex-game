import { GAMEPLAY, RUN_DURATION_MS } from "../constants";
import { clamp } from "./math";

export interface Difficulty {
  progress: number;
  tabIntervalMs: number;
  leakIntervalMs: number;
  notificationIntervalMs: number;
  tabSpeed: number;
  leakSpeed: number;
  notificationSpeed: number;
  deadline: boolean;
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

export function contextRatio(pendingTokens: number): number {
  return clamp(pendingTokens / GAMEPLAY.contextCapacity, 0, 1);
}

export function riskMultiplier(pendingTokens: number): number {
  if (pendingTokens >= 24) {
    return 4;
  }

  if (pendingTokens >= 18) {
    return 3;
  }

  if (pendingTokens >= 12) {
    return 2;
  }

  if (pendingTokens >= 6) {
    return 1.5;
  }

  return 1;
}

export function compactScore(pendingTokens: number): number {
  const safeTokens = clamp(Math.trunc(pendingTokens), 0, GAMEPLAY.contextCapacity);
  return Math.floor(safeTokens * GAMEPLAY.tokenValue * riskMultiplier(safeTokens));
}

export function compactRadius(pendingTokens: number): number {
  return Math.min(
    GAMEPLAY.compactMaxRadius,
    GAMEPLAY.compactBaseRadius +
      clamp(pendingTokens, 0, GAMEPLAY.contextCapacity) *
        GAMEPLAY.compactRadiusPerToken,
  );
}

export function desiredTrailPoints(pendingTokens: number): number {
  return (
    GAMEPLAY.baseTrailPoints +
    clamp(Math.trunc(pendingTokens), 0, GAMEPLAY.contextCapacity) *
      GAMEPLAY.trailPointsPerToken
  );
}

export function survivalBonus(lives: number): number {
  return Math.max(0, Math.trunc(lives)) * GAMEPLAY.survivalBonusPerLife;
}

export function difficultyAt(elapsedMs: number): Difficulty {
  const progress = clamp(elapsedMs / RUN_DURATION_MS, 0, 1);
  const deadline = elapsedMs >= RUN_DURATION_MS - 15_000;
  const intervalScale = deadline ? 0.75 : 1;

  return {
    progress,
    tabIntervalMs: lerp(2_800, 950, progress) * intervalScale,
    leakIntervalMs: lerp(14_000, 10_000, progress) * intervalScale,
    notificationIntervalMs: lerp(11_000, 7_000, progress) * intervalScale,
    tabSpeed: lerp(75, 140, progress),
    leakSpeed: lerp(70, 100, progress),
    notificationSpeed: lerp(500, 650, progress),
    deadline,
  };
}
