import { GAMEPLAY } from "../constants";
import { clamp } from "./math";

export interface Difficulty {
  progress: number;
  level: number;
  logIntervalMs: number;
  logSpeed: number;
  logBurst: number;
  reviewIntervalMs: number;
  reviewSpeed: number;
  contextMaxIntervalMs: number;
  contextMaxSize: number;
  mergeConflictIntervalMs: number;
  mergeConflictThickness: number;
  reviewUnlocked: boolean;
  contextMaxUnlocked: boolean;
  mergeConflictUnlocked: boolean;
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

export function difficultyAt(elapsedMs: number): Difficulty {
  const safeElapsedMs = Math.max(0, elapsedMs);
  const progress = clamp(safeElapsedMs / GAMEPLAY.difficultyRampMs, 0, 1);

  return {
    progress,
    level: Math.floor(safeElapsedMs / GAMEPLAY.levelDurationMs) + 1,
    logIntervalMs: lerp(1_150, 320, progress),
    logSpeed: lerp(280, 620, progress),
    logBurst: Math.min(4, 1 + Math.floor(safeElapsedMs / 22_000)),
    reviewIntervalMs: lerp(5_800, 2_800, progress),
    reviewSpeed: lerp(520, 820, progress),
    contextMaxIntervalMs: lerp(8_500, 5_500, progress),
    contextMaxSize: lerp(132, 216, progress),
    mergeConflictIntervalMs: lerp(11_000, 7_000, progress),
    mergeConflictThickness: lerp(90, 140, progress),
    reviewUnlocked: safeElapsedMs >= GAMEPLAY.reviewFirstSpawnMs,
    contextMaxUnlocked: safeElapsedMs >= GAMEPLAY.contextMaxFirstSpawnMs,
    mergeConflictUnlocked:
      safeElapsedMs >= GAMEPLAY.mergeConflictFirstSpawnMs,
  };
}

export function formatSurvivalTime(milliseconds: number): string {
  const safeMilliseconds = Math.max(0, Math.floor(milliseconds));
  const totalCentiseconds = Math.floor(safeMilliseconds / 10);
  const minutes = Math.floor(totalCentiseconds / 6_000);
  const seconds = Math.floor((totalCentiseconds % 6_000) / 100);
  const centiseconds = totalCentiseconds % 100;

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}.${centiseconds.toString().padStart(2, "0")}`;
}
