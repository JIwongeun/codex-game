import {
  DEFAULT_GAME_HEIGHT,
  DEFAULT_GAME_WIDTH,
  GAMEPLAY,
} from "../constants";
import {
  circleOverlapsOrientedRectangle,
  directionBetween,
  normalize,
  wrap,
} from "./math";
import type {
  ApprovalGateState,
  ApprovalGateGap,
  AreaHazardState,
  AttackPatternKind,
  AttackSurface,
  AttackSequenceState,
  ArenaBounds,
  DownloadAccessSector,
  GameEvent,
  GameState,
  HitEntityRef,
  HitSource,
  InputIntent,
  ProjectileLabel,
  ProjectileKind,
  ProjectileState,
  RectangleHitbox,
  ReasoningWaveState,
  RetryChainState,
  SequenceResultLabel,
  ToolCallLabel,
  Vec2,
} from "./model";
import {
  approvalGateGapSize,
  approvalGateSegments,
} from "./approvalGate";
import { nextRandom, normalizeSeed } from "./random";
import { difficultyAt } from "./rules";
import { TOOL_CALL_ENTRIES } from "./toolCallCorpus";

const PLAYER_START_DIRECTION: Vec2 = { x: 1, y: 0 };
const USAGE_LIMIT_RESULTS: readonly SequenceResultLabel[] = [
  "5H LIMIT REACHED",
  "WEEKLY LIMIT REACHED",
  "RESETS IN 4 DAYS",
];
const APPROVAL_GAP_LABELS: readonly ApprovalGateGap["label"][] = [
  "ALLOW ONCE",
  "ALLOW SESSION",
  "REVIEW",
  "DENY",
];
const CONTEXT_TOKEN_LABELS = [
  "context",
  "system",
  "developer",
  "user",
  "assistant",
  "reasoning",
  "summary",
  "memory",
  "prompt",
  "input",
  "output",
  "response",
  "message",
  "tool",
  "result",
  "function",
  "return",
  "const",
  "state",
  "player",
  "hazard",
  "projectile",
  "token",
  "window",
  "cache",
  "retry",
  "merge",
  "branch",
  "commit",
  "tests",
  "files",
  "patch",
  "build",
  "deploy",
  "await",
  "overflow",
  "stream",
  "buffer",
  "limit",
  "compact",
  "restore",
  "truncate",
  "src/",
  "diff",
  "plan",
  "true",
  "false",
  "null",
] as const;
const MAJOR_PATTERN_ORDER: readonly AttackPatternKind[] = [
  "approval-required",
  "context-compaction",
  "download-access",
  "retry-loop",
  "ultra-code",
  "parallel-agents",
  "review-fix-loop",
  "usage-limit",
  "wildcard-blackout",
];

export const EMPTY_INPUT: InputIntent = { direction: { x: 0, y: 0 } };

export function createGameState(
  seed: number,
  width = DEFAULT_GAME_WIDTH,
  height = DEFAULT_GAME_HEIGHT,
): GameState {
  const normalizedSeed = normalizeSeed(seed);
  const arena = createArena(width, height);

  const state: GameState = {
    phase: "ready",
    arena,
    seed: normalizedSeed,
    rngState: normalizedSeed,
    timingRngState: normalizeSeed(normalizedSeed ^ 0xa5a5_a5a5),
    nextEntityId: 1,
    elapsedMs: 0,
    score: 0,
    attacksDodged: 0,
    hazardsSurvived: 0,
    lastHitSource: null,
    lastHitEntity: null,
    player: {
      position: { x: arena.width / 2, y: arena.height / 2 },
      direction: { ...PLAYER_START_DIRECTION },
    },
    projectiles: [],
    hazards: [],
    sequences: [],
    approvalGates: [],
    retryChains: [],
    reasoningWaves: [],
    blackouts: [],
    ending: null,
    spawn: {
      toolCallMs: GAMEPLAY.toolCallFirstSpawnMs,
      approvalMs: GAMEPLAY.approvalFirstSpawnMs,
      compactionMs: GAMEPLAY.compactionFirstSpawnMs,
      downloadAccessMs: GAMEPLAY.downloadAccessFirstSpawnMs,
      retryLoopMs: GAMEPLAY.retryLoopFirstSpawnMs,
      reasoningMs: GAMEPLAY.reasoningFirstSpawnMs,
      parallelAgentsMs: GAMEPLAY.parallelAgentsFirstSpawnMs,
      reviewLoopMs: GAMEPLAY.reviewLoopFirstSpawnMs,
      usageLimitMs: GAMEPLAY.usageLimitFirstSpawnMs,
      blackoutMs: GAMEPLAY.blackoutFirstSpawnMs,
      majorPatternCooldownMs: 0,
      majorPatternCursor: 0,
    },
  };

  state.spawn.approvalMs = initialMajorPatternDelay(
    state,
    GAMEPLAY.approvalFirstSpawnMs,
  );
  state.spawn.compactionMs = initialMajorPatternDelay(
    state,
    GAMEPLAY.compactionFirstSpawnMs,
  );
  state.spawn.downloadAccessMs = initialMajorPatternDelay(
    state,
    GAMEPLAY.downloadAccessFirstSpawnMs,
  );
  state.spawn.retryLoopMs = initialMajorPatternDelay(
    state,
    GAMEPLAY.retryLoopFirstSpawnMs,
  );
  state.spawn.reasoningMs = initialMajorPatternDelay(
    state,
    GAMEPLAY.reasoningFirstSpawnMs,
  );
  state.spawn.parallelAgentsMs = initialMajorPatternDelay(
    state,
    GAMEPLAY.parallelAgentsFirstSpawnMs,
  );
  state.spawn.reviewLoopMs = initialMajorPatternDelay(
    state,
    GAMEPLAY.reviewLoopFirstSpawnMs,
  );
  state.spawn.usageLimitMs = initialMajorPatternDelay(
    state,
    GAMEPLAY.usageLimitFirstSpawnMs,
  );
  state.spawn.blackoutMs = initialMajorPatternDelay(
    state,
    GAMEPLAY.blackoutFirstSpawnMs,
  );

  return state;
}

export function startRun(state: GameState): GameEvent[] {
  if (state.phase !== "ready") {
    return [];
  }

  state.phase = "playing";
  return [{ type: "run-started" }];
}

export function restartRun(
  seed: number,
  width = DEFAULT_GAME_WIDTH,
  height = DEFAULT_GAME_HEIGHT,
): GameState {
  const state = createGameState(seed, width, height);
  startRun(state);
  return state;
}

export function resizeArena(
  state: GameState,
  width: number,
  height: number,
): void {
  const previousArena = state.arena;
  state.arena = createArena(width, height);
  state.player.position = clampPointToArena(
    state.player.position,
    state.arena,
    GAMEPLAY.playerRadius,
  );

  for (const hazard of state.hazards) {
    if (hazard.kind === "compaction") {
      const size = fitSquareSize(hazard.hitbox.width, state.arena);
      hazard.hitbox = { width: size, height: size };
      hazard.position = clampRectangleCenter(
        hazard.position,
        hazard.hitbox,
        state.arena,
      );
    } else {
      const geometry = downloadAccessGeometry(
        hazard.accessSector ?? "left",
        state.arena,
      );
      hazard.position = geometry.position;
      hazard.hitbox = geometry.hitbox;
    }
  }

  for (const sequence of state.sequences) {
    sequence.position = clampPointToArena(sequence.position, state.arena, 36);
    sequence.origins = sequence.origins.map((origin) =>
      clampPointToArena(origin, state.arena, 0),
    );
  }

  for (const gate of state.approvalGates) {
    if (Math.abs(gate.direction.x) > 0) {
      gate.position.x *= state.arena.width / previousArena.width;
    } else {
      gate.position.y *= state.arena.height / previousArena.height;
    }
    const perpendicularSize =
      Math.abs(gate.direction.x) > 0 ? state.arena.height : state.arena.width;
    const previousPerpendicularSize =
      Math.abs(gate.direction.x) > 0
        ? previousArena.height
        : previousArena.width;
    const scale = perpendicularSize / previousPerpendicularSize;
    const gapLimit = Math.max(
      GAMEPLAY.playerRadius * 4,
      perpendicularSize / Math.max(1, gate.gaps.length) - 12,
    );
    gate.gaps = gate.gaps.map((gap) => {
      const size = Math.min(
        perpendicularSize,
        gapLimit,
        approvalGateGapSize(gap.label),
      );
      return {
        ...gap,
        center: clampAxis(gap.center * scale, perpendicularSize, size / 2),
        size,
      };
    });
  }

  for (const retry of state.retryChains) {
    retry.position = clampPointToArena(retry.position, state.arena, 0);
    retry.target = clampPointToArena(retry.target, state.arena, 0);
    retry.velocity = directionBetween(retry.position, retry.target);
  }

  for (const wave of state.reasoningWaves) {
    const previousMaxRadius = wave.maxRadius;
    wave.center = clampPointToArena(
      wave.center,
      state.arena,
      GAMEPLAY.playerRadius,
    );
    wave.maxRadius = farthestCornerDistance(wave.center, state.arena);
    if (wave.phase === "thinking") {
      wave.radius = wave.maxRadius;
      wave.previousRadius = wave.maxRadius;
      wave.speed = wave.maxRadius / (wave.collapseDurationMs / 1_000);
    } else if (previousMaxRadius > 0) {
      const radiusScale = wave.maxRadius / previousMaxRadius;
      wave.radius *= radiusScale;
      wave.previousRadius *= radiusScale;
      wave.speed *= radiusScale;
    }
  }

  for (const blackout of state.blackouts) {
    const widthScale = state.arena.width / previousArena.width;
    const heightScale = state.arena.height / previousArena.height;
    const squareScale = Math.min(widthScale, heightScale);
    const side = blackout.hitbox.width * squareScale;
    blackout.hitbox = {
      width: side,
      height: side,
    };
    blackout.position = {
      x: blackout.position.x * widthScale,
      y: blackout.position.y * heightScale,
    };
    blackout.position = clampRectangleCenter(
      blackout.position,
      blackout.hitbox,
      state.arena,
    );
  }
}

function movePlayer(
  state: GameState,
  requestedDirection: Vec2,
  stepSeconds: number,
): void {
  if (
    !Number.isFinite(requestedDirection.x) ||
    !Number.isFinite(requestedDirection.y)
  ) {
    return;
  }

  const magnitude = Math.hypot(requestedDirection.x, requestedDirection.y);
  if (magnitude <= Number.EPSILON) {
    return;
  }

  const direction = normalize(requestedDirection, state.player.direction);
  const nextPosition = clampPointToArena(
    {
      x: state.player.position.x + direction.x * GAMEPLAY.playerSpeed * stepSeconds,
      y: state.player.position.y + direction.y * GAMEPLAY.playerSpeed * stepSeconds,
    },
    state.arena,
    GAMEPLAY.playerRadius,
  );
  state.player.direction = direction;
  state.player.position = nextPosition;
}

export function stepGame(
  state: GameState,
  intent: InputIntent,
  stepMs: number,
): GameEvent[] {
  if (state.phase !== "playing" || !Number.isFinite(stepMs) || stepMs <= 0) {
    return [];
  }

  const events: GameEvent[] = [];
  if (state.ending) {
    state.ending.elapsedMs = Math.min(
      state.ending.durationMs,
      state.ending.elapsedMs + stepMs,
    );
    if (state.ending.elapsedMs >= state.ending.durationMs) {
      state.ending = null;
      state.phase = "results";
      events.push({ type: "run-ended", finalScore: state.score, source: null });
    }
    return events;
  }

  const stepSeconds = stepMs / 1_000;
  state.elapsedMs += stepMs;
  state.score = Math.floor(state.elapsedMs);

  if (state.elapsedMs >= GAMEPLAY.endingAtMs) {
    beginEnding(state, events);
    return events;
  }

  movePlayer(state, intent.direction, stepSeconds);
  updateProjectiles(state, stepMs, stepSeconds);
  updateHazards(state, stepMs, events);
  updateSequences(state, stepMs, events);
  updateApprovalGates(state, stepMs, stepSeconds);
  updateRetryChains(state, stepMs, stepSeconds, events);
  updateReasoningWaves(state, stepMs, stepSeconds, events);
  updateBlackouts(state, stepMs);
  refreshActiveBlackoutProjectileGrace(state);
  spawnScheduledAttacks(state, stepMs, events);

  const hit = findHit(state);
  if (hit) {
    finishRun(state, hit.source, hit.entity, events);
  }

  return events;
}

function createArena(width: number, height: number): ArenaBounds {
  return {
    width: validDimension(width, DEFAULT_GAME_WIDTH),
    height: validDimension(height, DEFAULT_GAME_HEIGHT),
  };
}

function validDimension(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function clampPointToArena(
  point: Vec2,
  arena: ArenaBounds,
  inset: number,
): Vec2 {
  return {
    x: clampAxis(point.x, arena.width, inset),
    y: clampAxis(point.y, arena.height, inset),
  };
}

function clampAxis(value: number, size: number, inset: number): number {
  if (size <= inset * 2) {
    return size / 2;
  }
  return Math.min(size - inset, Math.max(inset, value));
}

function updateProjectiles(
  state: GameState,
  stepMs: number,
  stepSeconds: number,
): void {
  const survivors: ProjectileState[] = [];

  for (const projectile of state.projectiles) {
    const wasInsideBlackout = pointInsideActiveBlackout(
      state,
      projectile.position,
    );
    projectile.ageMs += stepMs;

    if (projectile.telegraphRemainingMs > 0) {
      projectile.telegraphRemainingMs = Math.max(
        0,
        projectile.telegraphRemainingMs - stepMs,
      );
    } else {
      projectile.position.x += projectile.velocity.x * projectile.speed * stepSeconds;
      projectile.position.y += projectile.velocity.y * projectile.speed * stepSeconds;
      if (projectile.kind === "context-token") {
        projectile.velocity.x *= Math.pow(
          projectile.horizontalDragPerSecond ??
            GAMEPLAY.contextTokenHorizontalDragPerSecond,
          stepSeconds,
        );
        projectile.velocity.y +=
          GAMEPLAY.contextTokenGravityPerSecond *
          (projectile.gravityScale ?? 1) *
          stepSeconds;
      }
    }

    if (
      wasInsideBlackout ||
      pointInsideActiveBlackout(state, projectile.position)
    ) {
      projectile.blackoutRevealGraceRemainingMs =
        GAMEPLAY.blackoutRevealGraceMs;
    } else {
      projectile.blackoutRevealGraceRemainingMs = Math.max(
        0,
        projectile.blackoutRevealGraceRemainingMs - stepMs,
      );
    }

    if (isInsideProjectileBounds(state, projectile.position)) {
      survivors.push(projectile);
    } else if (projectile.telegraphRemainingMs <= 0) {
      state.attacksDodged += 1;
    }
  }

  state.projectiles = survivors;
}

function updateHazards(
  state: GameState,
  stepMs: number,
  events: GameEvent[],
): void {
  const survivors: AreaHazardState[] = [];

  for (const hazard of state.hazards) {
    hazard.remainingMs -= stepMs;

    if (hazard.remainingMs > 0) {
      survivors.push(hazard);
      continue;
    }

    if (hazard.phase === "telegraph") {
      hazard.phase = "active";
      hazard.remainingMs =
        hazard.kind === "compaction"
          ? GAMEPLAY.compactionActiveMs
          : GAMEPLAY.downloadAccessActiveMs;
      survivors.push(hazard);
      if (hazard.kind === "compaction") {
        const difficulty = difficultyAt(state.elapsedMs);
        spawnContextTokens(
          state,
          hazard.position,
          difficulty.compactionFragmentCount,
          difficulty.compactionFragmentSpeed,
        );
      }
      events.push({
        type: "hazard-activated",
        kind: hazard.kind,
        position: { ...hazard.position },
      });
    } else {
      state.hazardsSurvived += 1;
    }
  }

  state.hazards = survivors;
}

function updateSequences(
  state: GameState,
  stepMs: number,
  events: GameEvent[],
): void {
  const survivors: AttackSequenceState[] = [];

  for (const sequence of state.sequences) {
    sequence.remainingMs -= stepMs;
    if (sequence.remainingMs > 0) {
      survivors.push(sequence);
      continue;
    }

    const projectileKind =
      sequence.kind === "review-loop" ? "finding" : "limit";
    spawnRadialProjectiles(
      state,
      projectileKind,
      sequence.resultLabel,
      sequence.position,
      sequence.projectileCount,
      sequence.projectileSpeed,
    );
    events.push({
      type: "pattern-burst",
      kind: sequence.kind,
      position: { ...sequence.position },
    });
  }

  state.sequences = survivors;
}

function updateApprovalGates(
  state: GameState,
  stepMs: number,
  stepSeconds: number,
): void {
  const survivors: ApprovalGateState[] = [];

  for (const gate of state.approvalGates) {
    if (gate.telegraphRemainingMs > 0) {
      gate.telegraphRemainingMs = Math.max(
        0,
        gate.telegraphRemainingMs - stepMs,
      );
      survivors.push(gate);
      continue;
    }

    gate.position.x += gate.direction.x * gate.speed * stepSeconds;
    gate.position.y += gate.direction.y * gate.speed * stepSeconds;
    if (isApprovalGateInsideBounds(gate, state.arena)) {
      survivors.push(gate);
    } else {
      state.attacksDodged += 1;
    }
  }

  state.approvalGates = survivors;
}

function updateRetryChains(
  state: GameState,
  stepMs: number,
  stepSeconds: number,
  events: GameEvent[],
): void {
  const survivors: RetryChainState[] = [];

  for (const retry of state.retryChains) {
    if (retry.completionRemainingMs > 0) {
      retry.completionRemainingMs = Math.max(
        0,
        retry.completionRemainingMs - stepMs,
      );
      if (retry.completionRemainingMs > 0) {
        survivors.push(retry);
      }
      continue;
    }

    if (retry.telegraphRemainingMs > 0) {
      retry.telegraphRemainingMs = Math.max(
        0,
        retry.telegraphRemainingMs - stepMs,
      );
      survivors.push(retry);
      continue;
    }

    const distance = Math.hypot(
      retry.target.x - retry.position.x,
      retry.target.y - retry.position.y,
    );
    const travel = retry.speed * stepSeconds;
    if (distance > travel) {
      retry.position.x += retry.velocity.x * travel;
      retry.position.y += retry.velocity.y * travel;
      survivors.push(retry);
      continue;
    }

    retry.position = { ...retry.target };
    if (retry.attempt >= retry.totalAttempts) {
      state.attacksDodged += 1;
      retry.completionRemainingMs = GAMEPLAY.retryChainCompleteMs;
      events.push({
        type: "pattern-complete",
        kind: "retry-loop",
        position: { ...retry.position },
      });
      survivors.push(retry);
      continue;
    }

    retry.attempt += 1;
    retry.target = { ...state.player.position };
    retry.velocity = directionBetween(retry.position, retry.target);
    retry.speed *= GAMEPLAY.retryChainSpeedGain;
    retry.telegraphRemainingMs = GAMEPLAY.retryChainTelegraphMs;
    survivors.push(retry);
  }

  state.retryChains = survivors;
}

function updateReasoningWaves(
  state: GameState,
  stepMs: number,
  stepSeconds: number,
  events: GameEvent[],
): void {
  const survivors: ReasoningWaveState[] = [];

  for (const wave of state.reasoningWaves) {
    if (wave.phase === "thinking") {
      wave.telegraphRemainingMs = Math.max(
        0,
        wave.telegraphRemainingMs - stepMs,
      );
      if (wave.telegraphRemainingMs <= 0) {
        wave.phase = "active";
        wave.radius = wave.maxRadius;
        wave.previousRadius = wave.maxRadius;
        events.push({
          type: "pattern-burst",
          kind: "ultra-code",
          position: { ...wave.center },
        });
      }
      survivors.push(wave);
      continue;
    }

    if (wave.radius <= 0) {
      state.attacksDodged += 1;
      continue;
    }

    wave.previousRadius = wave.radius;
    wave.radius = Math.max(0, wave.radius - wave.speed * stepSeconds);
    survivors.push(wave);
  }

  state.reasoningWaves = survivors;
}

function updateBlackouts(state: GameState, stepMs: number): void {
  state.blackouts = state.blackouts.filter((blackout) => {
    if (blackout.telegraphRemainingMs > 0) {
      blackout.telegraphRemainingMs = Math.max(
        0,
        blackout.telegraphRemainingMs - stepMs,
      );
      return true;
    }
    blackout.remainingMs -= stepMs;
    return blackout.remainingMs > 0;
  });
}

function refreshActiveBlackoutProjectileGrace(state: GameState): void {
  for (const projectile of state.projectiles) {
    if (pointInsideActiveBlackout(state, projectile.position)) {
      projectile.blackoutRevealGraceRemainingMs =
        GAMEPLAY.blackoutRevealGraceMs;
    }
  }
}

function spawnScheduledAttacks(
  state: GameState,
  stepMs: number,
  events: GameEvent[],
): void {
  const difficulty = difficultyAt(state.elapsedMs);
  const intervalScale = responsiveSpawnIntervalScale(state.arena);
  state.spawn.toolCallMs -= stepMs;
  state.spawn.approvalMs -= stepMs;
  state.spawn.compactionMs -= stepMs;
  state.spawn.downloadAccessMs -= stepMs;
  state.spawn.retryLoopMs -= stepMs;
  state.spawn.reasoningMs -= stepMs;
  state.spawn.parallelAgentsMs -= stepMs;
  state.spawn.reviewLoopMs -= stepMs;
  state.spawn.usageLimitMs -= stepMs;
  state.spawn.blackoutMs -= stepMs;
  state.spawn.majorPatternCooldownMs = Math.max(
    0,
    state.spawn.majorPatternCooldownMs - stepMs,
  );
  const activeMajorPatterns = activeMajorPatternFamilies(state);
  const selectedMajorPattern = selectMajorPattern(
    state,
    difficulty,
    activeMajorPatterns,
  );

  const reserveMajorPattern = (kind: AttackPatternKind): void => {
    activeMajorPatterns.add(kind);
    state.spawn.majorPatternCooldownMs = GAMEPLAY.majorPatternSeparationMs;
  };

  if (state.spawn.toolCallMs <= 0) {
    spawnToolCall(state, difficulty.toolCallSpeed);
    state.spawn.toolCallMs += difficulty.toolCallIntervalMs * intervalScale;
  }

  if (
    selectedMajorPattern === "approval-required" &&
    difficulty.approvalUnlocked &&
    state.spawn.approvalMs <= 0
  ) {
    if (
      spawnApprovalGate(
        state,
        difficulty.approvalSpeed,
        difficulty.approvalGapCount,
      )
    ) {
      events.push({ type: "pattern-warning", kind: "approval-required" });
      reserveMajorPattern("approval-required");
    }
    state.spawn.approvalMs += randomizedMajorPatternInterval(
      state,
      difficulty.approvalIntervalMs * intervalScale,
    );
  }

  if (
    selectedMajorPattern === "context-compaction" &&
    difficulty.compactionUnlocked &&
    state.spawn.compactionMs <= 0
  ) {
    if (
      spawnCompaction(
        state,
        difficulty.compactionSize,
        state.player.position,
      )
    ) {
      events.push({ type: "hazard-warning", kind: "compaction" });
      reserveMajorPattern("context-compaction");
    }
    state.spawn.compactionMs += randomizedMajorPatternInterval(
      state,
      difficulty.compactionIntervalMs * intervalScale,
    );
  }

  if (
    selectedMajorPattern === "download-access" &&
    difficulty.downloadAccessUnlocked &&
    state.spawn.downloadAccessMs <= 0
  ) {
    if (spawnDownloadAccess(state)) {
      events.push({ type: "hazard-warning", kind: "download-access" });
      reserveMajorPattern("download-access");
    }
    state.spawn.downloadAccessMs += randomizedMajorPatternInterval(
      state,
      difficulty.downloadAccessIntervalMs * intervalScale,
    );
  }

  if (
    selectedMajorPattern === "retry-loop" &&
    difficulty.retryLoopUnlocked &&
    state.spawn.retryLoopMs <= 0
  ) {
    if (spawnRetryChain(
      state,
      difficulty.retryLoopCount,
      difficulty.retryLoopSpeed,
    )) {
      events.push({ type: "pattern-warning", kind: "retry-loop" });
      reserveMajorPattern("retry-loop");
    }
    state.spawn.retryLoopMs += randomizedMajorPatternInterval(
      state,
      difficulty.retryLoopIntervalMs * intervalScale,
    );
  }

  if (
    selectedMajorPattern === "ultra-code" &&
    difficulty.reasoningUnlocked &&
    state.spawn.reasoningMs <= 0
  ) {
    if (
      spawnUltraCode(
        state,
        difficulty.reasoningCollapseMs,
        difficulty.reasoningSafeArc,
      )
    ) {
      events.push({ type: "pattern-warning", kind: "ultra-code" });
      reserveMajorPattern("ultra-code");
    }
    state.spawn.reasoningMs += randomizedMajorPatternInterval(
      state,
      difficulty.reasoningIntervalMs * intervalScale,
    );
  }

  if (
    selectedMajorPattern === "parallel-agents" &&
    difficulty.parallelAgentsUnlocked &&
    state.spawn.parallelAgentsMs <= 0
  ) {
    if (spawnParallelAgents(
      state,
      difficulty.parallelAgentPairs,
      difficulty.parallelAgentSpeed,
    )) {
      events.push({ type: "pattern-warning", kind: "parallel-agents" });
      reserveMajorPattern("parallel-agents");
    }
    state.spawn.parallelAgentsMs += randomizedMajorPatternInterval(
      state,
      difficulty.parallelAgentsIntervalMs * intervalScale,
    );
  }

  if (
    selectedMajorPattern === "review-fix-loop" &&
    difficulty.reviewLoopUnlocked &&
    state.spawn.reviewLoopMs <= 0
  ) {
    if (
      spawnSequence(
        state,
        "review-loop",
        difficulty.reviewFindingCount,
        difficulty.reviewFindingSpeed,
      )
    ) {
      events.push({ type: "pattern-warning", kind: "review-loop" });
      reserveMajorPattern("review-fix-loop");
    }
    state.spawn.reviewLoopMs += randomizedMajorPatternInterval(
      state,
      difficulty.reviewLoopIntervalMs * intervalScale,
    );
  }

  if (
    selectedMajorPattern === "usage-limit" &&
    difficulty.usageLimitUnlocked &&
    state.spawn.usageLimitMs <= 0
  ) {
    if (
      spawnSequence(
        state,
        "usage-limit",
        difficulty.limitFragmentCount,
        difficulty.limitFragmentSpeed,
        difficulty.usageDrainCount,
      )
    ) {
      events.push({ type: "pattern-warning", kind: "usage-limit" });
      reserveMajorPattern("usage-limit");
    }
    state.spawn.usageLimitMs += randomizedMajorPatternInterval(
      state,
      difficulty.usageLimitIntervalMs * intervalScale,
    );
  }

  if (
    selectedMajorPattern === "wildcard-blackout" &&
    difficulty.blackoutUnlocked &&
    state.spawn.blackoutMs <= 0
  ) {
    if (spawnBlackout(state, difficulty)) {
      events.push({
        type: "blackout-started",
        position: { ...state.blackouts.at(-1)!.position },
      });
      reserveMajorPattern("wildcard-blackout");
    }
    state.spawn.blackoutMs += randomizedMajorPatternInterval(
      state,
      difficulty.blackoutIntervalMs * intervalScale,
      GAMEPLAY.blackoutMinimumSpawnIntervalMs,
    );
  }
}

function initialMajorPatternDelay(state: GameState, firstSpawnMs: number): number {
  return firstSpawnMs + randomTimingBetween(
    state,
    0,
    GAMEPLAY.majorPatternTimingJitterMs,
  );
}

function randomizedMajorPatternInterval(
  state: GameState,
  intervalMs: number,
  minimumIntervalMs: number = GAMEPLAY.majorPatternMinimumIntervalMs,
): number {
  return Math.max(
    minimumIntervalMs,
    intervalMs + randomTimingBetween(
      state,
      -GAMEPLAY.majorPatternTimingJitterMs,
      GAMEPLAY.majorPatternTimingJitterMs,
    ),
  );
}

function selectMajorPattern(
  state: GameState,
  difficulty: ReturnType<typeof difficultyAt>,
  active: ReadonlySet<AttackPatternKind>,
): AttackPatternKind | null {
  if (state.spawn.majorPatternCooldownMs > 0) {
    return null;
  }

  if (active.size >= GAMEPLAY.maxConcurrentMajorPatterns) {
    return null;
  }

  for (let offset = 0; offset < MAJOR_PATTERN_ORDER.length; offset += 1) {
    const index = (state.spawn.majorPatternCursor + offset) %
      MAJOR_PATTERN_ORDER.length;
    const kind = MAJOR_PATTERN_ORDER[index]!;
    if (!majorPatternIsDue(kind, state, difficulty)) {
      continue;
    }
    state.spawn.majorPatternCursor = (index + 1) % MAJOR_PATTERN_ORDER.length;
    return kind;
  }
  return null;
}

function majorPatternIsDue(
  kind: AttackPatternKind,
  state: GameState,
  difficulty: ReturnType<typeof difficultyAt>,
): boolean {
  if (kind === "approval-required") {
    return difficulty.approvalUnlocked && state.spawn.approvalMs <= 0;
  }
  if (kind === "context-compaction") {
    return difficulty.compactionUnlocked && state.spawn.compactionMs <= 0;
  }
  if (kind === "download-access") {
    return (
      difficulty.downloadAccessUnlocked && state.spawn.downloadAccessMs <= 0
    );
  }
  if (kind === "retry-loop") {
    return difficulty.retryLoopUnlocked && state.spawn.retryLoopMs <= 0;
  }
  if (kind === "ultra-code") {
    return difficulty.reasoningUnlocked && state.spawn.reasoningMs <= 0;
  }
  if (kind === "parallel-agents") {
    return (
      difficulty.parallelAgentsUnlocked && state.spawn.parallelAgentsMs <= 0
    );
  }
  if (kind === "review-fix-loop") {
    return difficulty.reviewLoopUnlocked && state.spawn.reviewLoopMs <= 0;
  }
  if (kind === "usage-limit") {
    return difficulty.usageLimitUnlocked && state.spawn.usageLimitMs <= 0;
  }
  return difficulty.blackoutUnlocked && state.spawn.blackoutMs <= 0;
}

function activeMajorPatternFamilies(state: GameState): Set<AttackPatternKind> {
  const active = new Set<AttackPatternKind>();
  if (state.approvalGates.length > 0) {
    active.add("approval-required");
  }
  if (
    state.hazards.some(({ kind }) => kind === "compaction") ||
    state.projectiles.some(({ kind }) => kind === "context-token")
  ) {
    active.add("context-compaction");
  }
  if (state.hazards.some(({ kind }) => kind === "download-access")) {
    active.add("download-access");
  }
  if (state.retryChains.length > 0) {
    active.add("retry-loop");
  }
  if (state.reasoningWaves.length > 0) {
    active.add("ultra-code");
  }
  if (state.projectiles.some(({ kind }) => kind === "agent")) {
    active.add("parallel-agents");
  }
  if (
    state.sequences.some(({ kind }) => kind === "review-loop") ||
    state.projectiles.some(({ kind }) => kind === "finding")
  ) {
    active.add("review-fix-loop");
  }
  if (
    state.sequences.some(({ kind }) => kind === "usage-limit") ||
    state.projectiles.some(({ kind }) => kind === "limit")
  ) {
    active.add("usage-limit");
  }
  if (state.blackouts.length > 0) {
    active.add("wildcard-blackout");
  }
  return active;
}

function responsiveSpawnIntervalScale(arena: ArenaBounds): number {
  const areaRatio =
    (arena.width * arena.height) /
    (DEFAULT_GAME_WIDTH * DEFAULT_GAME_HEIGHT);
  return areaRatio < GAMEPLAY.smallViewportAreaThresholdRatio
    ? GAMEPLAY.smallViewportIntervalMultiplier
    : 1;
}

function spawnToolCall(state: GameState, speed: number): void {
  if (state.projectiles.length >= GAMEPLAY.maxProjectiles) {
    return;
  }

  const sourceEdge = Math.floor(randomBetween(state, 0, 4));
  const targetEdge = sourceEdge ^ 1;
  const sourceAlongSize =
    sourceEdge < 2 ? state.arena.height : state.arena.width;
  const targetAlongSize =
    targetEdge < 2 ? state.arena.height : state.arena.width;
  const position = pointOnEdge(
    state.arena,
    sourceEdge,
    randomBetween(state, sourceAlongSize * 0.08, sourceAlongSize * 0.92),
    20,
  );
  const target = pointOnEdge(
    state.arena,
    targetEdge,
    randomBetween(state, targetAlongSize * 0.08, targetAlongSize * 0.92),
    20,
  );
  const entry = randomToolCallEntry(state);

  addProjectile(
    state,
    "tool-call",
    entry.surface,
    entry.label,
    position,
    target,
    toolCallHitbox(entry.label),
    speed,
    GAMEPLAY.toolCallTelegraphMs,
  );
}

function spawnApprovalGate(
  state: GameState,
  speed: number,
  requestedGapCount: number,
): boolean {
  if (state.approvalGates.length >= GAMEPLAY.maxApprovalGates) {
    return false;
  }

  const edge = Math.floor(randomBetween(state, 0, 4));
  const horizontal = edge < 2;
  const perpendicularSize = horizontal
    ? state.arena.height
    : state.arena.width;
  const playerAlong = horizontal
    ? state.player.position.y
    : state.player.position.x;
  const gaps = createApprovalGaps(
    state,
    perpendicularSize,
    requestedGapCount,
    playerAlong,
  );
  const margin = GAMEPLAY.approvalGateThickness;
  const position = pointOnEdge(state.arena, edge, 0, margin);
  const direction =
    edge === 0
      ? { x: 1, y: 0 }
      : edge === 1
        ? { x: -1, y: 0 }
        : edge === 2
          ? { x: 0, y: 1 }
          : { x: 0, y: -1 };

  state.approvalGates.push({
    id: takeEntityId(state),
    position,
    direction,
    gaps,
    thickness: GAMEPLAY.approvalGateThickness,
    speed,
    telegraphRemainingMs: GAMEPLAY.approvalGateTelegraphMs,
  });
  return true;
}

function createApprovalGaps(
  state: GameState,
  perpendicularSize: number,
  requestedCount: number,
  playerAlong: number,
): ApprovalGateGap[] {
  let count = Math.max(3, Math.min(4, Math.floor(requestedCount)));
  const largestLabelGap = Math.max(
    ...APPROVAL_GAP_LABELS.slice(0, count).map(approvalGateGapSize),
  );
  while (
    count > 3 &&
    perpendicularSize / count < largestLabelGap + 12
  ) {
    count -= 1;
  }
  const slotSize = perpendicularSize / count;
  const playerSlot = Math.max(
    0,
    Math.min(count - 1, Math.floor(playerAlong / slotSize)),
  );
  const gaps: ApprovalGateGap[] = [];

  for (let index = 0; index < count; index += 1) {
    const label = APPROVAL_GAP_LABELS[index] ?? "DENY";
    const gapSize = Math.min(
      approvalGateGapSize(label),
      Math.max(GAMEPLAY.playerRadius * 4, slotSize - 12),
    );
    const slotStart = index * slotSize;
    const minimumCenter = slotStart + gapSize / 2;
    const maximumCenter = slotStart + slotSize - gapSize / 2;
    const jitter = slotSize * 0.08;
    const center = index === playerSlot
      ? clampAxis(playerAlong, perpendicularSize, gapSize / 2)
      : randomBetween(
          state,
          Math.max(minimumCenter, slotStart + slotSize / 2 - jitter),
          Math.min(maximumCenter, slotStart + slotSize / 2 + jitter),
        );
    gaps.push({
      center: Math.min(maximumCenter, Math.max(minimumCenter, center)),
      size: gapSize,
      label,
    });
  }

  return gaps.sort((left, right) => left.center - right.center);
}

function spawnRetryChain(
  state: GameState,
  count: number,
  speed: number,
): boolean {
  if (state.retryChains.length >= GAMEPLAY.maxRetryChains) {
    return false;
  }

  const edge = Math.floor(randomBetween(state, 0, 4));
  const alongSize = edge < 2 ? state.arena.height : state.arena.width;
  const position = pointOnEdge(
    state.arena,
    edge,
    randomBetween(state, alongSize * 0.16, alongSize * 0.84),
    24,
  );
  const target = { ...state.player.position };
  state.retryChains.push({
    id: takeEntityId(state),
    position,
    target,
    velocity: directionBetween(position, target),
    hitbox: {
      width: GAMEPLAY.retryChainHitboxWidth,
      height: GAMEPLAY.retryChainHitboxHeight,
    },
    speed,
    attempt: 1,
    totalAttempts: count,
    telegraphRemainingMs: GAMEPLAY.retryChainTelegraphMs,
    completionRemainingMs: 0,
  });
  return true;
}

function spawnUltraCode(
  state: GameState,
  collapseDurationMs: number,
  safeArc: number,
): boolean {
  if (state.reasoningWaves.length >= GAMEPLAY.maxReasoningWaves) {
    return false;
  }

  const center = { ...state.player.position };
  const nearHorizontalEdge =
    center.x <= state.arena.width * GAMEPLAY.reasoningEdgeInsetRatio ||
    center.x >= state.arena.width * (1 - GAMEPLAY.reasoningEdgeInsetRatio);
  const nearVerticalEdge =
    center.y <= state.arena.height * GAMEPLAY.reasoningEdgeInsetRatio ||
    center.y >= state.arena.height * (1 - GAMEPLAY.reasoningEdgeInsetRatio);
  const safeTarget =
    nearHorizontalEdge || nearVerticalEdge
      ? { x: state.arena.width / 2, y: state.arena.height / 2 }
      : randomRectangleCenter(state, { width: 1, height: 1 });
  const safeDirection = directionBetween(center, safeTarget);
  const maxRadius = farthestCornerDistance(center, state.arena);
  const speed = maxRadius / (collapseDurationMs / 1_000);
  state.reasoningWaves.push({
    id: takeEntityId(state),
    center,
    safeAngle: Math.atan2(safeDirection.y, safeDirection.x),
    safeArc,
    radius: maxRadius,
    previousRadius: maxRadius,
    maxRadius,
    thickness: GAMEPLAY.reasoningWaveThickness,
    speed,
    collapseDurationMs,
    phase: "thinking",
    telegraphRemainingMs: GAMEPLAY.reasoningTelegraphMs,
    telegraphDurationMs: GAMEPLAY.reasoningTelegraphMs,
  });
  return true;
}

function spawnParallelAgents(
  state: GameState,
  pairCount: number,
  speed: number,
): boolean {
  const availablePairs = Math.min(
    pairCount,
    Math.floor((GAMEPLAY.maxProjectiles - state.projectiles.length) / 2),
  );
  const target = { ...state.player.position };

  if (availablePairs <= 0) {
    return false;
  }

  for (let index = 0; index < availablePairs; index += 1) {
    const horizontal = index % 2 === 0;
    const offset = (index - (availablePairs - 1) / 2) * 34;
    const pairTarget = horizontal
      ? {
          x: target.x,
          y: clampAxis(target.y + offset, state.arena.height, 36),
        }
      : {
          x: clampAxis(target.x + offset, state.arena.width, 36),
          y: target.y,
        };
    const positions = horizontal
      ? [
          { x: -24, y: pairTarget.y },
          { x: state.arena.width + 24, y: pairTarget.y },
        ]
      : [
          { x: pairTarget.x, y: -24 },
          { x: pairTarget.x, y: state.arena.height + 24 },
        ];

    addProjectile(
      state,
      "agent",
      "codex",
      `[agent ${index * 2 + 1}] working`,
      positions[0]!,
      pairTarget,
      { width: 92, height: 15 },
      speed,
      760 + index * 100,
    );
    addProjectile(
      state,
      "agent",
      "codex",
      `[agent ${index * 2 + 2}] working`,
      positions[1]!,
      pairTarget,
      { width: 92, height: 15 },
      speed,
      760 + index * 100,
    );
  }
  return true;
}

function spawnSequence(
  state: GameState,
  kind: "review-loop" | "usage-limit",
  projectileCount: number,
  projectileSpeed: number,
  mergeIncomingCount = 4,
): boolean {
  if (state.sequences.length >= GAMEPLAY.maxSequences) {
    return false;
  }

  const position =
    kind === "review-loop"
      ? randomRectangleCenter(state, { width: 220, height: 220 })
      : clampPointToArena(state.player.position, state.arena, 90);
  const originCount = kind === "review-loop" ? 4 : mergeIncomingCount;
  const origins: Vec2[] = [];

  for (let index = 0; index < originCount; index += 1) {
    const edge =
      index % 4;
    const alongSize = edge < 2 ? state.arena.height : state.arena.width;
    origins.push(
      pointOnEdge(
        state.arena,
        edge,
        randomBetween(state, alongSize * 0.12, alongSize * 0.88),
        28,
      ),
    );
  }

  const durationMs =
    kind === "review-loop"
      ? GAMEPLAY.reviewLoopConvergeMs
      : GAMEPLAY.usageLimitConvergeMs;
  state.sequences.push({
    id: takeEntityId(state),
    kind,
    label:
      kind === "review-loop"
        ? "[review] fixing findings"
        : "[usage] limit draining",
    position,
    origins,
    remainingMs: durationMs,
    durationMs,
    projectileCount,
    projectileSpeed,
    resultLabel:
      kind === "review-loop"
        ? "ONE MORE ISSUE"
        : randomUsageLimitResult(state),
  });
  return true;
}

function spawnRadialProjectiles(
  state: GameState,
  kind: "finding" | "limit",
  label: string,
  center: Vec2,
  count: number,
  speed: number,
): void {
  const available = Math.min(
    count,
    GAMEPLAY.maxProjectiles - state.projectiles.length,
  );
  if (available <= 0) {
    return;
  }

  const phase = randomBetween(state, 0, Math.PI * 2);
  for (let index = 0; index < available; index += 1) {
    const angle = phase + (Math.PI * 2 * index) / available;
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    const position = {
      x: center.x + direction.x * 56,
      y: center.y + direction.y * 56,
    };
    const target = {
      x: position.x + direction.x * 100,
      y: position.y + direction.y * 100,
    };
    addProjectile(
      state,
      kind,
      "codex",
      label,
      position,
      target,
      {
        width: kind === "finding" ? 86 : 78,
        height: GAMEPLAY.fragmentHitboxHeight,
      },
      speed,
      0,
    );
  }
}

function spawnContextTokens(
  state: GameState,
  center: Vec2,
  count: number,
  speed: number,
): void {
  const available = Math.min(
    count,
    GAMEPLAY.maxProjectiles - state.projectiles.length,
  );
  if (available <= 0) {
    return;
  }

  const labels = [...CONTEXT_TOKEN_LABELS];
  for (let index = 0; index < available; index += 1) {
    const angle = randomBetween(state, 0, Math.PI * 2);
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    const originAngle = angle + randomBetween(state, -0.52, 0.52);
    const originRadius = randomBetween(
      state,
      GAMEPLAY.contextTokenBurstMinRadius,
      GAMEPLAY.contextTokenBurstMaxRadius,
    );
    const position = {
      x: center.x + Math.cos(originAngle) * originRadius,
      y: center.y + Math.sin(originAngle) * originRadius,
    };
    const target = {
      x: position.x + direction.x * 100,
      y: position.y + direction.y * 100,
    };
    const labelIndex = Math.floor(randomBetween(state, 0, labels.length));
    const [label = "context"] = labels.splice(labelIndex, 1);
    const projectile = addProjectile(
      state,
      "context-token",
      "codex",
      label,
      position,
      target,
      {
        width: labelHitboxWidth(
          label,
          GAMEPLAY.contextTokenHitboxMinWidth,
          GAMEPLAY.contextTokenHitboxMaxWidth,
        ),
        height: GAMEPLAY.contextTokenHitboxHeight,
      },
      speed * randomBetween(state, 0.58, 1.28),
      0,
    );
    projectile.gravityScale = randomBetween(state, 0.7, 1.45);
    projectile.horizontalDragPerSecond = randomBetween(state, 0.58, 0.86);
  }
}

function addProjectile(
  state: GameState,
  kind: ProjectileKind,
  surface: AttackSurface,
  label: ProjectileLabel,
  position: Vec2,
  target: Vec2,
  hitbox: RectangleHitbox,
  speed: number,
  telegraphMs: number,
): ProjectileState {
  const projectile: ProjectileState = {
    id: takeEntityId(state),
    kind,
    surface,
    label,
    position,
    velocity: directionBetween(position, target),
    hitbox,
    speed,
    ageMs: 0,
    telegraphRemainingMs: telegraphMs,
    blackoutRevealGraceRemainingMs: 0,
  };
  state.projectiles.push(projectile);
  return projectile;
}

function randomToolCallEntry(
  state: GameState,
): (typeof TOOL_CALL_ENTRIES)[number] {
  const index = Math.floor(randomBetween(state, 0, TOOL_CALL_ENTRIES.length));
  return TOOL_CALL_ENTRIES[index] ?? TOOL_CALL_ENTRIES[0];
}

function randomUsageLimitResult(state: GameState): SequenceResultLabel {
  const index = Math.floor(randomBetween(state, 0, USAGE_LIMIT_RESULTS.length));
  return USAGE_LIMIT_RESULTS[index] ?? USAGE_LIMIT_RESULTS[0];
}

function toolCallHitbox(label: ToolCallLabel): RectangleHitbox {
  return {
    width: labelHitboxWidth(
      label,
      GAMEPLAY.toolCallHitboxMinWidth,
      GAMEPLAY.toolCallHitboxMaxWidth,
    ),
    height: GAMEPLAY.toolCallHitboxHeight,
  };
}

function labelHitboxWidth(
  label: ProjectileLabel,
  minimum: number,
  maximum: number,
): number {
  return Math.min(maximum, Math.max(minimum, 14 + label.length * 6));
}

function pointOnEdge(
  arena: ArenaBounds,
  edge: number,
  along: number,
  margin: number,
): Vec2 {
  if (edge === 0) {
    return { x: -margin, y: along };
  }
  if (edge === 1) {
    return { x: arena.width + margin, y: along };
  }
  if (edge === 2) {
    return { x: along, y: -margin };
  }
  return { x: along, y: arena.height + margin };
}

function spawnCompaction(
  state: GameState,
  requestedSize: number,
  target: Vec2,
): boolean {
  if (state.hazards.length >= GAMEPLAY.maxHazards) {
    return false;
  }

  const hitbox = squareHitbox(requestedSize, state.arena);
  const position = clampRectangleCenter(
    target,
    hitbox,
    state.arena,
  );

  state.hazards.push({
    id: takeEntityId(state),
    kind: "compaction",
    label: "CONTEXT COMPACTION",
    position,
    hitbox,
    phase: "telegraph",
    remainingMs: GAMEPLAY.compactionTelegraphMs,
  });
  return true;
}

function spawnDownloadAccess(state: GameState): boolean {
  if (state.hazards.length >= GAMEPLAY.maxHazards) {
    return false;
  }

  const sectors: readonly DownloadAccessSector[] = [
    "top",
    "bottom",
    "left",
    "right",
  ];
  const sector = sectors[Math.floor(randomBetween(state, 0, sectors.length))] ??
    "top";
  const geometry = downloadAccessGeometry(sector, state.arena);

  state.hazards.push({
    id: takeEntityId(state),
    kind: "download-access",
    label: "DOWNLOAD ACCESS",
    position: geometry.position,
    hitbox: geometry.hitbox,
    phase: "telegraph",
    remainingMs: GAMEPLAY.downloadAccessTelegraphMs,
    accessSector: sector,
  });
  return true;
}

function spawnBlackout(
  state: GameState,
  difficulty: ReturnType<typeof difficultyAt>,
): boolean {
  if (state.blackouts.length >= difficulty.blackoutMaxActive) {
    return false;
  }

  const side = Math.min(state.arena.width, state.arena.height) * randomBetween(
    state,
    difficulty.blackoutSizeRatio[0],
    difficulty.blackoutSizeRatio[1],
  );
  const hitbox = { width: side, height: side };
  let position = randomBlackoutCenter(state, hitbox);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (!state.blackouts.some((blackout) => blackoutOverlapRatio(
      position,
      hitbox,
      blackout.position,
      blackout.hitbox,
    ) > 0.72)) {
      break;
    }
    position = randomBlackoutCenter(state, hitbox);
  }

  state.blackouts.push({
    id: takeEntityId(state),
    position,
    hitbox,
    telegraphRemainingMs: GAMEPLAY.blackoutTelegraphMs,
    remainingMs: difficulty.blackoutDurationMs,
    durationMs: difficulty.blackoutDurationMs,
  });
  return true;
}

function blackoutOverlapRatio(
  firstPosition: Vec2,
  first: RectangleHitbox,
  secondPosition: Vec2,
  second: RectangleHitbox,
): number {
  const overlapWidth = Math.max(
    0,
    Math.min(
      firstPosition.x + first.width / 2,
      secondPosition.x + second.width / 2,
    ) - Math.max(
      firstPosition.x - first.width / 2,
      secondPosition.x - second.width / 2,
    ),
  );
  const overlapHeight = Math.max(
    0,
    Math.min(
      firstPosition.y + first.height / 2,
      secondPosition.y + second.height / 2,
    ) - Math.max(
      firstPosition.y - first.height / 2,
      secondPosition.y - second.height / 2,
    ),
  );
  return (overlapWidth * overlapHeight) / Math.max(1, first.width * first.height);
}

function squareHitbox(size: number, arena: ArenaBounds): RectangleHitbox {
  const fittedSize = fitSquareSize(size, arena);
  return { width: fittedSize, height: fittedSize };
}

function fitSquareSize(size: number, arena: ArenaBounds): number {
  return Math.max(
    1,
    Math.min(
      size,
      Math.min(arena.width, arena.height) *
        GAMEPLAY.compactionMaxViewportRatio,
    ),
  );
}

function downloadAccessGeometry(
  sector: DownloadAccessSector,
  arena: ArenaBounds,
): { position: Vec2; hitbox: RectangleHitbox } {
  if (sector === "top" || sector === "bottom") {
    const hitbox = { width: arena.width, height: arena.height / 2 };
    return {
      position: {
        x: arena.width / 2,
        y: sector === "top" ? arena.height / 4 : arena.height * 0.75,
      },
      hitbox,
    };
  }

  const hitbox = { width: arena.width / 2, height: arena.height };
  return {
    position: {
      x: sector === "left" ? arena.width / 4 : arena.width * 0.75,
      y: arena.height / 2,
    },
    hitbox,
  };
}

function clampRectangleCenter(
  position: Vec2,
  hitbox: RectangleHitbox,
  arena: ArenaBounds,
): Vec2 {
  return {
    x: clampAxis(position.x, arena.width, hitbox.width / 2),
    y: clampAxis(position.y, arena.height, hitbox.height / 2),
  };
}

function farthestCornerDistance(center: Vec2, arena: ArenaBounds): number {
  return (
    Math.max(
      Math.hypot(center.x, center.y),
      Math.hypot(arena.width - center.x, center.y),
      Math.hypot(center.x, arena.height - center.y),
      Math.hypot(arena.width - center.x, arena.height - center.y),
    ) +
    GAMEPLAY.reasoningWaveThickness / 2 +
    GAMEPLAY.playerRadius
  );
}

function randomRectangleCenter(
  state: GameState,
  hitbox: RectangleHitbox,
): Vec2 {
  const halfWidth = Math.min(hitbox.width / 2, state.arena.width / 2);
  const halfHeight = Math.min(hitbox.height / 2, state.arena.height / 2);
  return {
    x: randomBetween(
      state,
      halfWidth,
      state.arena.width - halfWidth,
    ),
    y: randomBetween(
      state,
      halfHeight,
      state.arena.height - halfHeight,
    ),
  };
}

function randomBlackoutCenter(
  state: GameState,
  hitbox: RectangleHitbox,
): Vec2 {
  let position = randomRectangleCenter(state, hitbox);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const insideCenterBand =
      Math.abs(position.x - state.arena.width / 2) < state.arena.width * 0.12 &&
      Math.abs(position.y - state.arena.height / 2) < state.arena.height * 0.12;
    if (!insideCenterBand) {
      return position;
    }
    position = randomRectangleCenter(state, hitbox);
  }
  return position;
}

interface HitResult {
  source: HitSource;
  entity: HitEntityRef;
}

function findHit(state: GameState): HitResult | null {
  for (const projectile of state.projectiles) {
    const sharesBlackoutWithPlayer = pointsShareActiveBlackout(
      state,
      projectile.position,
      state.player.position,
    );
    if (
      projectile.telegraphRemainingMs <= 0 &&
      (
        projectile.blackoutRevealGraceRemainingMs <= 0 ||
        sharesBlackoutWithPlayer
      ) &&
      circleOverlapsOrientedRectangle(
        state.player.position,
        GAMEPLAY.playerRadius,
        projectile.position,
        projectile.hitbox,
        projectile.velocity,
      )
    ) {
      return {
        source: projectile.kind,
        entity: { kind: "projectile", id: projectile.id },
      };
    }
  }

  for (const wave of state.reasoningWaves) {
    if (reasoningWaveHitsPlayer(wave, state.player.position)) {
      return {
        source: "reasoning",
        entity: { kind: "reasoning-wave", id: wave.id },
      };
    }
  }

  for (const hazard of state.hazards) {
    if (
      hazard.kind === "download-access" &&
      hazard.phase === "active" &&
      circleOverlapsOrientedRectangle(
        state.player.position,
        GAMEPLAY.playerRadius,
        hazard.position,
        hazard.hitbox,
        { x: 1, y: 0 },
      )
    ) {
      return {
        source: "access",
        entity: { kind: "download-access", id: hazard.id },
      };
    }
  }

  for (const gate of state.approvalGates) {
    if (gate.telegraphRemainingMs > 0) {
      continue;
    }
    for (const segment of approvalGateSegments(gate, state.arena)) {
      if (
        segment.hitbox.width > 0 &&
        segment.hitbox.height > 0 &&
        circleOverlapsOrientedRectangle(
          state.player.position,
          GAMEPLAY.playerRadius,
          segment.position,
          segment.hitbox,
          { x: 1, y: 0 },
        )
      ) {
        return {
          source: "approval",
          entity: { kind: "approval-gate", id: gate.id },
        };
      }
    }
  }

  for (const retry of state.retryChains) {
    if (
      retry.completionRemainingMs <= 0 &&
      retry.telegraphRemainingMs <= 0 &&
      circleOverlapsOrientedRectangle(
        state.player.position,
        GAMEPLAY.playerRadius,
        retry.position,
        retry.hitbox,
        retry.velocity,
      )
    ) {
      return {
        source: "retry",
        entity: { kind: "retry-chain", id: retry.id },
      };
    }
  }

  return null;
}

function pointInsideActiveBlackout(state: GameState, point: Vec2): boolean {
  return state.blackouts.some(
    (blackout) =>
      blackout.telegraphRemainingMs <= 0 &&
      Math.abs(point.x - blackout.position.x) <= blackout.hitbox.width / 2 &&
      Math.abs(point.y - blackout.position.y) <= blackout.hitbox.height / 2,
  );
}

function pointsShareActiveBlackout(
  state: GameState,
  first: Vec2,
  second: Vec2,
): boolean {
  return state.blackouts.some(
    (blackout) =>
      blackout.telegraphRemainingMs <= 0 &&
      Math.abs(first.x - blackout.position.x) <= blackout.hitbox.width / 2 &&
      Math.abs(first.y - blackout.position.y) <= blackout.hitbox.height / 2 &&
      Math.abs(second.x - blackout.position.x) <= blackout.hitbox.width / 2 &&
      Math.abs(second.y - blackout.position.y) <= blackout.hitbox.height / 2,
  );
}

function reasoningWaveHitsPlayer(
  wave: ReasoningWaveState,
  playerPosition: Vec2,
): boolean {
  if (wave.phase !== "active") {
    return false;
  }

  const distance = Math.hypot(
    playerPosition.x - wave.center.x,
    playerPosition.y - wave.center.y,
  );
  const collisionPadding = wave.thickness / 2 + GAMEPLAY.playerRadius;
  const sweptInnerRadius = Math.max(
    0,
    Math.min(wave.previousRadius, wave.radius) - collisionPadding,
  );
  const sweptOuterRadius =
    Math.max(wave.previousRadius, wave.radius) + collisionPadding;
  if (distance < sweptInnerRadius || distance > sweptOuterRadius) {
    return false;
  }

  if (distance <= GAMEPLAY.playerRadius) {
    return true;
  }

  const playerAngle = Math.atan2(
    playerPosition.y - wave.center.y,
    playerPosition.x - wave.center.x,
  );
  const angleFromSafeCenter = wrap(
    playerAngle - wave.safeAngle,
    -Math.PI,
    Math.PI,
  );
  return Math.abs(angleFromSafeCenter) > wave.safeArc / 2;
}

function isApprovalGateInsideBounds(
  gate: ApprovalGateState,
  arena: ArenaBounds,
): boolean {
  const margin = gate.thickness * 2;
  return (
    gate.position.x >= -margin &&
    gate.position.x <= arena.width + margin &&
    gate.position.y >= -margin &&
    gate.position.y <= arena.height + margin
  );
}

function isInsideProjectileBounds(state: GameState, position: Vec2): boolean {
  const margin = GAMEPLAY.projectileMargin;
  return (
    position.x >= -margin &&
    position.x <= state.arena.width + margin &&
    position.y >= -margin &&
    position.y <= state.arena.height + margin
  );
}

function randomBetween(state: GameState, minimum: number, maximum: number): number {
  const random = nextRandom(state.rngState);
  state.rngState = random.state;
  return minimum + random.value * (maximum - minimum);
}

function randomTimingBetween(
  state: GameState,
  minimum: number,
  maximum: number,
): number {
  const random = nextRandom(state.timingRngState);
  state.timingRngState = random.state;
  return minimum + random.value * (maximum - minimum);
}

function takeEntityId(state: GameState): number {
  const id = state.nextEntityId;
  state.nextEntityId += 1;
  return id;
}

function finishRun(
  state: GameState,
  source: HitSource,
  entity: HitEntityRef,
  events: GameEvent[],
): void {
  if (state.phase !== "playing") {
    return;
  }

  state.phase = "results";
  state.lastHitSource = source;
  state.lastHitEntity = entity;
  events.push({ type: "player-hit", source });
  events.push({ type: "run-ended", finalScore: state.score, source });
}

function beginEnding(state: GameState, events: GameEvent[]): void {
  state.elapsedMs = GAMEPLAY.endingAtMs;
  state.score = GAMEPLAY.endingAtMs;
  state.projectiles = [];
  state.hazards = [];
  state.sequences = [];
  state.approvalGates = [];
  state.retryChains = [];
  state.reasoningWaves = [];
  state.blackouts = [];
  state.ending = {
    elapsedMs: 0,
    durationMs: GAMEPLAY.endingDurationMs,
  };
  events.push({ type: "ending-started" });
}
