import { GAMEPLAY } from "../constants";
import { clamp } from "./math";

export interface Difficulty {
  progress: number;
  stage: number;
  toolCallIntervalMs: number;
  toolCallSpeed: number;
  toolCallBurst: number;
  approvalIntervalMs: number;
  approvalSpeed: number;
  compactionIntervalMs: number;
  compactionCount: number;
  compactionSize: number;
  compactionFragmentCount: number;
  compactionFragmentSpeed: number;
  retryLoopIntervalMs: number;
  retryLoopCount: number;
  reasoningIntervalMs: number;
  reasoningSpeed: number;
  parallelAgentsIntervalMs: number;
  parallelAgentPairs: number;
  parallelAgentSpeed: number;
  reviewLoopIntervalMs: number;
  reviewFindingCount: number;
  reviewFindingSpeed: number;
  usageLimitIntervalMs: number;
  usageDrainCount: number;
  limitFragmentCount: number;
  limitFragmentSpeed: number;
  approvalUnlocked: boolean;
  compactionUnlocked: boolean;
  retryLoopUnlocked: boolean;
  reasoningUnlocked: boolean;
  parallelAgentsUnlocked: boolean;
  reviewLoopUnlocked: boolean;
  usageLimitUnlocked: boolean;
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
    toolCallIntervalMs: lerp(1_050, 380, progress),
    toolCallSpeed: lerp(270, 570, progress),
    toolCallBurst: stage >= 9 ? 3 : stage >= 5 ? 2 : 1,
    approvalIntervalMs: lerp(6_200, 3_100, progress),
    approvalSpeed: lerp(470, 740, progress),
    compactionIntervalMs: lerp(8_400, 4_200, progress),
    compactionCount: stage >= 10 ? 3 : stage >= 8 ? 2 : 1,
    compactionSize: lerp(
      GAMEPLAY.compactionStartSize,
      GAMEPLAY.compactionEndSize,
      progress,
    ),
    compactionFragmentCount: stage >= 10 ? 20 : stage >= 8 ? 16 : 12,
    compactionFragmentSpeed: lerp(300, 520, progress),
    retryLoopIntervalMs: lerp(9_800, 4_800, progress),
    retryLoopCount: stage >= 9 ? 5 : stage >= 6 ? 4 : 3,
    reasoningIntervalMs: lerp(11_500, 5_800, progress),
    reasoningSpeed: lerp(760, 1_080, progress),
    parallelAgentsIntervalMs: lerp(9_500, 4_700, progress),
    parallelAgentPairs: stage >= 10 ? 3 : stage >= 9 ? 2 : 1,
    parallelAgentSpeed: lerp(420, 760, progress),
    reviewLoopIntervalMs: lerp(10_800, 5_400, progress),
    reviewFindingCount: stage >= 10 ? 16 : stage >= 9 ? 12 : 8,
    reviewFindingSpeed: lerp(260, 500, progress),
    usageLimitIntervalMs: lerp(12_500, 6_000, progress),
    usageDrainCount: stage >= 10 ? 8 : stage >= 9 ? 6 : 4,
    limitFragmentCount: stage >= 10 ? 20 : stage >= 9 ? 16 : 12,
    limitFragmentSpeed: lerp(280, 540, progress),
    approvalUnlocked: safeElapsedMs >= GAMEPLAY.approvalFirstSpawnMs,
    compactionUnlocked: safeElapsedMs >= GAMEPLAY.compactionFirstSpawnMs,
    retryLoopUnlocked: safeElapsedMs >= GAMEPLAY.retryLoopFirstSpawnMs,
    reasoningUnlocked: safeElapsedMs >= GAMEPLAY.reasoningFirstSpawnMs,
    parallelAgentsUnlocked:
      safeElapsedMs >= GAMEPLAY.parallelAgentsFirstSpawnMs,
    reviewLoopUnlocked: safeElapsedMs >= GAMEPLAY.reviewLoopFirstSpawnMs,
    usageLimitUnlocked: safeElapsedMs >= GAMEPLAY.usageLimitFirstSpawnMs,
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
