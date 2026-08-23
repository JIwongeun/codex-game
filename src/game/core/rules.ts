import { GAMEPLAY } from "../constants";
import { clamp } from "./math";

export interface Difficulty {
  progress: number;
  level: number;
  tabIntervalMs: number;
  tabSpeed: number;
  tabBurst: number;
  popupIntervalMs: number;
  popupSpeed: number;
  memoryLeakIntervalMs: number;
  memoryLeakRadius: number;
  contextSweepIntervalMs: number;
  contextSweepThickness: number;
  popupUnlocked: boolean;
  memoryLeakUnlocked: boolean;
  contextSweepUnlocked: boolean;
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
    tabIntervalMs: lerp(1_180, 260, progress),
    tabSpeed: lerp(270, 660, progress),
    tabBurst: Math.min(4, 1 + Math.floor(safeElapsedMs / 22_000)),
    popupIntervalMs: lerp(5_800, 2_200, progress),
    popupSpeed: lerp(520, 860, progress),
    memoryLeakIntervalMs: lerp(8_000, 3_600, progress),
    memoryLeakRadius: lerp(82, 142, progress),
    contextSweepIntervalMs: lerp(11_000, 5_500, progress),
    contextSweepThickness: lerp(92, 154, progress),
    popupUnlocked: safeElapsedMs >= GAMEPLAY.popupFirstSpawnMs,
    memoryLeakUnlocked: safeElapsedMs >= GAMEPLAY.memoryLeakFirstSpawnMs,
    contextSweepUnlocked: safeElapsedMs >= GAMEPLAY.contextSweepFirstSpawnMs,
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
