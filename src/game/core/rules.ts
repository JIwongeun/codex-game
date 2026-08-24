import { GAMEPLAY } from "../constants";
import { clamp } from "./math";

export interface Difficulty {
  progress: number;
  stage: number;
  toolCallIntervalMs: number;
  toolCallSpeed: number;
  approvalIntervalMs: number;
  approvalSpeed: number;
  approvalGapCount: number;
  compactionIntervalMs: number;
  compactionSize: number;
  compactionFragmentCount: number;
  compactionFragmentSpeed: number;
  downloadAccessIntervalMs: number;
  retryLoopIntervalMs: number;
  retryLoopCount: number;
  retryLoopSpeed: number;
  reasoningIntervalMs: number;
  reasoningCollapseMs: number;
  reasoningSafeArc: number;
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
  blackoutIntervalMs: number;
  blackoutDurationMs: number;
  blackoutMaxActive: number;
  blackoutWidthRatio: readonly [number, number];
  blackoutHeightRatio: readonly [number, number];
  approvalUnlocked: boolean;
  compactionUnlocked: boolean;
  downloadAccessUnlocked: boolean;
  retryLoopUnlocked: boolean;
  reasoningUnlocked: boolean;
  parallelAgentsUnlocked: boolean;
  reviewLoopUnlocked: boolean;
  usageLimitUnlocked: boolean;
  blackoutUnlocked: boolean;
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
  const stageTenIntervalMultiplier = stage >= 10 ? 0.84 : 1;
  const stageTenSpeedMultiplier = stage >= 10 ? 1.08 : 1;
  const postStageTenMs = Math.max(
    0,
    safeElapsedMs - GAMEPLAY.difficultyRampMs,
  );
  const blackoutRamp = clamp(
    postStageTenMs / GAMEPLAY.blackoutPostStageRampMs,
    0,
    1,
  );
  const reasoningProgress = clamp(
    (safeElapsedMs - GAMEPLAY.reasoningFirstSpawnMs) /
      (GAMEPLAY.difficultyRampMs - GAMEPLAY.reasoningFirstSpawnMs),
    0,
    1,
  );
  const blackoutMaxActive =
    stage < 10 ? 1 : postStageTenMs >= 60_000 ? 4 : postStageTenMs >= 30_000 ? 3 : 2;

  return {
    progress,
    stage,
    toolCallIntervalMs:
      lerp(1_050, 380, progress) * stageTenIntervalMultiplier,
    toolCallSpeed: lerp(270, 570, progress) * stageTenSpeedMultiplier,
    approvalIntervalMs:
      lerp(14_000, 12_000, progress) * stageTenIntervalMultiplier,
    approvalSpeed: lerp(300, 350, progress) * stageTenSpeedMultiplier,
    approvalGapCount: 4,
    compactionIntervalMs:
      lerp(8_400, 4_200, progress) * stageTenIntervalMultiplier,
    compactionSize: lerp(
      GAMEPLAY.compactionStartSize,
      GAMEPLAY.compactionEndSize,
      progress,
    ),
    compactionFragmentCount: stage >= 10 ? 20 : stage >= 8 ? 16 : 12,
    compactionFragmentSpeed:
      lerp(300, 520, progress) * stageTenSpeedMultiplier,
    downloadAccessIntervalMs:
      lerp(12_000, 7_500, progress) * stageTenIntervalMultiplier,
    retryLoopIntervalMs:
      lerp(9_800, 4_800, progress) * stageTenIntervalMultiplier,
    retryLoopCount: stage >= 9 ? 5 : stage >= 6 ? 4 : 3,
    retryLoopSpeed: lerp(440, 696, progress) * stageTenSpeedMultiplier,
    reasoningIntervalMs:
      lerp(11_500, 5_800, progress) * stageTenIntervalMultiplier,
    reasoningCollapseMs: lerp(1_000, 700, reasoningProgress),
    reasoningSafeArc: lerp(
      (85 * Math.PI) / 180,
      (68 * Math.PI) / 180,
      reasoningProgress,
    ),
    parallelAgentsIntervalMs:
      lerp(9_500, 4_700, progress) * stageTenIntervalMultiplier,
    parallelAgentPairs: stage >= 10 ? 3 : stage >= 9 ? 2 : 1,
    parallelAgentSpeed: lerp(420, 760, progress) * stageTenSpeedMultiplier,
    reviewLoopIntervalMs:
      lerp(10_800, 5_400, progress) * stageTenIntervalMultiplier,
    reviewFindingCount: stage >= 10 ? 16 : stage >= 9 ? 12 : 8,
    reviewFindingSpeed: lerp(260, 500, progress) * stageTenSpeedMultiplier,
    usageLimitIntervalMs:
      lerp(12_500, 6_000, progress) * stageTenIntervalMultiplier,
    usageDrainCount: stage >= 10 ? 8 : stage >= 9 ? 6 : 4,
    limitFragmentCount: stage >= 10 ? 20 : stage >= 9 ? 16 : 12,
    limitFragmentSpeed: lerp(280, 540, progress) * stageTenSpeedMultiplier,
    blackoutIntervalMs:
      stage < 10
        ? GAMEPLAY.blackoutStageNineIntervalMs
        : lerp(
            GAMEPLAY.blackoutStageTenStartIntervalMs,
            GAMEPLAY.blackoutMinimumIntervalMs,
            blackoutRamp,
          ),
    blackoutDurationMs:
      stage < 10
        ? GAMEPLAY.blackoutStageNineDurationMs
        : GAMEPLAY.blackoutStageTenDurationMs,
    blackoutMaxActive,
    blackoutWidthRatio: stage < 10 ? [0.36, 0.46] : [0.26, 0.34],
    blackoutHeightRatio: stage < 10 ? [0.28, 0.38] : [0.22, 0.3],
    approvalUnlocked: safeElapsedMs >= GAMEPLAY.approvalFirstSpawnMs,
    compactionUnlocked: safeElapsedMs >= GAMEPLAY.compactionFirstSpawnMs,
    downloadAccessUnlocked:
      safeElapsedMs >= GAMEPLAY.downloadAccessFirstSpawnMs,
    retryLoopUnlocked: safeElapsedMs >= GAMEPLAY.retryLoopFirstSpawnMs,
    reasoningUnlocked: safeElapsedMs >= GAMEPLAY.reasoningFirstSpawnMs,
    parallelAgentsUnlocked:
      safeElapsedMs >= GAMEPLAY.parallelAgentsFirstSpawnMs,
    reviewLoopUnlocked: safeElapsedMs >= GAMEPLAY.reviewLoopFirstSpawnMs,
    usageLimitUnlocked: safeElapsedMs >= GAMEPLAY.usageLimitFirstSpawnMs,
    blackoutUnlocked: safeElapsedMs >= GAMEPLAY.stageDurationMs * 8,
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
