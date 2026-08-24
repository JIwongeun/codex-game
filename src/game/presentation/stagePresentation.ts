import { GAMEPLAY } from "../constants";

export function simulatedContextLoadK(stage: number): number {
  const safeStage = Math.min(
    GAMEPLAY.maxStage,
    Math.max(1, Math.floor(stage)),
  );
  return 2 ** (safeStage - 1);
}

export function stageDisplayLabel(stage: number): string {
  const safeStage = Math.min(
    GAMEPLAY.maxStage,
    Math.max(1, Math.floor(stage)),
  );
  const prefix = `STAGE ${safeStage.toString().padStart(2, "0")}`;
  const context = `${simulatedContextLoadK(safeStage)}K`;

  return safeStage === GAMEPLAY.maxStage
    ? `${prefix}  ·  ${context} // OVERFLOW`
    : `${prefix}  ·  ${context}`;
}
