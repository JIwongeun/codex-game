import { GAMEPLAY } from "../constants";
import { clamp } from "./math";

export interface Difficulty {
  progress: number;
  stage: number;
  logIntervalMs: number;
  logSpeed: number;
  logBurst: number;
  reviewIntervalMs: number;
  reviewSpeed: number;
  contextMaxIntervalMs: number;
  contextMaxCount: number;
  contextMaxSize: number;
  retryLoopIntervalMs: number;
  retryLoopCount: number;
  forkBombIntervalMs: number;
  forkFragmentCount: number;
  forkFragmentSpeed: number;
  raceConditionIntervalMs: number;
  racePairCount: number;
  raceSpeed: number;
  mergeBugIntervalMs: number;
  mergeIncomingCount: number;
  bugFragmentCount: number;
  bugFragmentSpeed: number;
  reviewUnlocked: boolean;
  contextMaxUnlocked: boolean;
  retryLoopUnlocked: boolean;
  forkBombUnlocked: boolean;
  raceConditionUnlocked: boolean;
  mergeBugUnlocked: boolean;
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

export function difficultyAt(elapsedMs: number): Difficulty {
  const safeElapsedMs = Math.max(0, elapsedMs);
  const progress = clamp(safeElapsedMs / GAMEPLAY.difficultyRampMs, 0, 1);
  const stage = Math.min(
    GAMEPLAY.maxStage,
    Math.floor(safeElapsedMs / GAMEPLAY.stageDurationMs) + 1,
  );

  return {
    progress,
    stage,
    logIntervalMs: lerp(1_050, 380, progress),
    logSpeed: lerp(270, 570, progress),
    logBurst: stage >= 9 ? 3 : stage >= 5 ? 2 : 1,
    reviewIntervalMs: lerp(6_200, 3_100, progress),
    reviewSpeed: lerp(470, 740, progress),
    contextMaxIntervalMs: lerp(8_000, 4_000, progress),
    contextMaxCount: stage >= 10 ? 3 : stage >= 8 ? 2 : 1,
    contextMaxSize: lerp(210, 320, progress),
    retryLoopIntervalMs: lerp(9_800, 4_800, progress),
    retryLoopCount: stage >= 9 ? 5 : stage >= 6 ? 4 : 3,
    forkBombIntervalMs: lerp(10_500, 5_200, progress),
    forkFragmentCount: stage >= 10 ? 16 : stage >= 8 ? 12 : 8,
    forkFragmentSpeed: lerp(260, 500, progress),
    raceConditionIntervalMs: lerp(9_500, 4_600, progress),
    racePairCount: stage >= 10 ? 3 : stage >= 8 ? 2 : 1,
    raceSpeed: lerp(420, 760, progress),
    mergeBugIntervalMs: lerp(12_000, 5_800, progress),
    mergeIncomingCount: stage >= 10 ? 8 : stage >= 9 ? 6 : 4,
    bugFragmentCount: stage >= 10 ? 20 : stage >= 9 ? 16 : 12,
    bugFragmentSpeed: lerp(280, 540, progress),
    reviewUnlocked: safeElapsedMs >= GAMEPLAY.reviewFirstSpawnMs,
    contextMaxUnlocked: safeElapsedMs >= GAMEPLAY.contextMaxFirstSpawnMs,
    retryLoopUnlocked: safeElapsedMs >= GAMEPLAY.retryLoopFirstSpawnMs,
    forkBombUnlocked: safeElapsedMs >= GAMEPLAY.forkBombFirstSpawnMs,
    raceConditionUnlocked:
      safeElapsedMs >= GAMEPLAY.raceConditionFirstSpawnMs,
    mergeBugUnlocked: safeElapsedMs >= GAMEPLAY.mergeBugFirstSpawnMs,
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
