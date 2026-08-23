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
  AreaHazardState,
  AttackSurface,
  AttackSequenceState,
  ArenaBounds,
  GameEvent,
  GameState,
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
import { approvalGateSegments } from "./approvalGate";
import { nextRandom, normalizeSeed } from "./random";
import { difficultyAt } from "./rules";
import { TOOL_CALL_ENTRIES } from "./toolCallCorpus";

const PLAYER_START_DIRECTION: Vec2 = { x: 1, y: 0 };
const USAGE_LIMIT_RESULTS: readonly SequenceResultLabel[] = [
  "5H LIMIT REACHED",
  "WEEKLY LIMIT REACHED",
  "RESETS IN 4 DAYS",
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

export const EMPTY_INPUT: InputIntent = { direction: { x: 0, y: 0 } };

export function createGameState(
  seed: number,
  width = DEFAULT_GAME_WIDTH,
  height = DEFAULT_GAME_HEIGHT,
): GameState {
  const normalizedSeed = normalizeSeed(seed);
  const arena = createArena(width, height);

  return {
    phase: "ready",
    arena,
    seed: normalizedSeed,
    rngState: normalizedSeed,
    nextEntityId: 1,
    elapsedMs: 0,
    score: 0,
    attacksDodged: 0,
    hazardsSurvived: 0,
    lastHitSource: null,
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
      retryLoopMs: GAMEPLAY.retryLoopFirstSpawnMs,
      reasoningMs: GAMEPLAY.reasoningFirstSpawnMs,
      parallelAgentsMs: GAMEPLAY.parallelAgentsFirstSpawnMs,
      reviewLoopMs: GAMEPLAY.reviewLoopFirstSpawnMs,
      usageLimitMs: GAMEPLAY.usageLimitFirstSpawnMs,
      blackoutMs: GAMEPLAY.blackoutFirstSpawnMs,
    },
  };
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
    } else {
      hazard.hitbox = fitFullAccessHitbox(hazard.hitbox, state.arena);
    }
    hazard.position = clampRectangleCenter(
      hazard.position,
      hazard.hitbox,
      state.arena,
    );
  }

  for (const sequence of state.sequences) {
    sequence.position = clampPointToArena(sequence.position, state.arena, 36);
    sequence.origins = sequence.origins.map((origin) =>
      clampPointToArena(origin, state.arena, 0),
    );
  }

  for (const gate of state.approvalGates) {
    const perpendicularSize =
      Math.abs(gate.direction.x) > 0 ? state.arena.height : state.arena.width;
    gate.gapCenter = clampAxis(
      gate.gapCenter,
      perpendicularSize,
      gate.gapSize / 2,
    );
  }

  for (const retry of state.retryChains) {
    retry.position = clampPointToArena(retry.position, state.arena, 0);
    retry.target = clampPointToArena(retry.target, state.arena, 0);
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
    blackout.hitbox = {
      width: Math.min(blackout.hitbox.width, state.arena.width * 0.46),
      height: Math.min(blackout.hitbox.height, state.arena.height * 0.38),
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
  updateRetryChains(state, stepMs, stepSeconds);
  updateReasoningWaves(state, stepMs, stepSeconds, events);
  updateBlackouts(state, stepMs);
  spawnScheduledAttacks(state, stepMs, events);

  const hitSource = findHitSource(state);
  if (hitSource) {
    finishRun(state, hitSource, events);
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
          : GAMEPLAY.fullAccessActiveMs;
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
): void {
  const survivors: RetryChainState[] = [];

  for (const retry of state.retryChains) {
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
          kind: "reasoning-xhigh",
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
    blackout.remainingMs -= stepMs;
    return blackout.remainingMs > 0;
  });
}

function spawnScheduledAttacks(
  state: GameState,
  stepMs: number,
  events: GameEvent[],
): void {
  const difficulty = difficultyAt(state.elapsedMs);
  state.spawn.toolCallMs -= stepMs;
  state.spawn.approvalMs -= stepMs;
  state.spawn.compactionMs -= stepMs;
  state.spawn.retryLoopMs -= stepMs;
  state.spawn.reasoningMs -= stepMs;
  state.spawn.parallelAgentsMs -= stepMs;
  state.spawn.reviewLoopMs -= stepMs;
  state.spawn.usageLimitMs -= stepMs;
  state.spawn.blackoutMs -= stepMs;

  if (state.spawn.toolCallMs <= 0) {
    spawnToolCall(state, difficulty.toolCallSpeed);
    state.spawn.toolCallMs += difficulty.toolCallIntervalMs;
  }

  if (difficulty.approvalUnlocked && state.spawn.approvalMs <= 0) {
    if (spawnApprovalGate(state, difficulty.approvalSpeed)) {
      events.push({ type: "pattern-warning", kind: "approval-required" });
    }
    state.spawn.approvalMs += difficulty.approvalIntervalMs;
  }

  if (difficulty.compactionUnlocked && state.spawn.compactionMs <= 0) {
    const available = Math.min(
      difficulty.compactionCount,
      GAMEPLAY.maxHazards - state.hazards.length,
    );
    for (let index = 0; index < available; index += 1) {
      if (index === 0) {
        if (
          spawnCompaction(
            state,
            difficulty.compactionSize,
            state.player.position,
          )
        ) {
          events.push({ type: "hazard-warning", kind: "compaction" });
        }
        continue;
      }

      const accessHitbox = fitFullAccessHitbox(
        {
          width: GAMEPLAY.fullAccessWidth,
          height: GAMEPLAY.fullAccessHeight,
        },
        state.arena,
      );
      const target =
        index === 1
          ? state.player.position
          : randomRectangleCenter(state, accessHitbox);
      if (spawnFullAccess(state, target, accessHitbox)) {
        events.push({ type: "hazard-warning", kind: "full-access" });
      }
    }
    state.spawn.compactionMs += difficulty.compactionIntervalMs;
  }

  if (difficulty.retryLoopUnlocked && state.spawn.retryLoopMs <= 0) {
    if (spawnRetryChain(
      state,
      difficulty.retryLoopCount,
      difficulty.approvalSpeed * 0.94,
    )) {
      events.push({ type: "pattern-warning", kind: "retry-loop" });
    }
    state.spawn.retryLoopMs += difficulty.retryLoopIntervalMs;
  }

  if (difficulty.reasoningUnlocked && state.spawn.reasoningMs <= 0) {
    if (
      spawnReasoningXhigh(
        state,
        difficulty.reasoningCollapseMs,
        difficulty.reasoningSafeArc,
      )
    ) {
      events.push({ type: "pattern-warning", kind: "reasoning-xhigh" });
    }
    state.spawn.reasoningMs += difficulty.reasoningIntervalMs;
  }

  if (
    difficulty.parallelAgentsUnlocked &&
    state.spawn.parallelAgentsMs <= 0
  ) {
    spawnParallelAgents(
      state,
      difficulty.parallelAgentPairs,
      difficulty.parallelAgentSpeed,
    );
    events.push({ type: "pattern-warning", kind: "parallel-agents" });
    state.spawn.parallelAgentsMs += difficulty.parallelAgentsIntervalMs;
  }

  if (difficulty.reviewLoopUnlocked && state.spawn.reviewLoopMs <= 0) {
    if (
      spawnSequence(
        state,
        "review-loop",
        difficulty.reviewFindingCount,
        difficulty.reviewFindingSpeed,
      )
    ) {
      events.push({ type: "pattern-warning", kind: "review-loop" });
    }
    state.spawn.reviewLoopMs += difficulty.reviewLoopIntervalMs;
  }

  if (difficulty.usageLimitUnlocked && state.spawn.usageLimitMs <= 0) {
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
    }
    state.spawn.usageLimitMs += difficulty.usageLimitIntervalMs;
  }

  if (difficulty.blackoutUnlocked && state.spawn.blackoutMs <= 0) {
    if (spawnBlackout(state, difficulty)) {
      events.push({
        type: "blackout-started",
        position: { ...state.blackouts.at(-1)!.position },
      });
    }
    state.spawn.blackoutMs += difficulty.blackoutIntervalMs;
  }
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

function spawnApprovalGate(state: GameState, speed: number): boolean {
  if (state.approvalGates.length >= GAMEPLAY.maxApprovalGates) {
    return false;
  }

  const edge = Math.floor(randomBetween(state, 0, 4));
  const horizontal = edge < 2;
  const perpendicularSize = horizontal
    ? state.arena.height
    : state.arena.width;
  const gapSize = Math.min(
    GAMEPLAY.approvalGateMaxGap,
    Math.max(
      GAMEPLAY.approvalGateMinGap,
      perpendicularSize * 0.16,
    ),
  );
  const gapCenter = randomBetween(
    state,
    gapSize / 2 + 20,
    perpendicularSize - gapSize / 2 - 20,
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
    gapCenter,
    gapSize,
    thickness: GAMEPLAY.approvalGateThickness,
    speed,
    telegraphRemainingMs: GAMEPLAY.approvalGateTelegraphMs,
  });
  return true;
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
  });
  return true;
}

function spawnReasoningXhigh(
  state: GameState,
  collapseDurationMs: number,
  safeArc: number,
): boolean {
  if (state.reasoningWaves.length >= GAMEPLAY.maxReasoningWaves) {
    return false;
  }

  const center = { ...state.player.position };
  const safeTarget = randomRectangleCenter(state, { width: 1, height: 1 });
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
): void {
  const availablePairs = Math.min(
    pairCount,
    Math.floor((GAMEPLAY.maxProjectiles - state.projectiles.length) / 2),
  );
  const target = { ...state.player.position };

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

function spawnFullAccess(
  state: GameState,
  target: Vec2,
  hitbox: RectangleHitbox,
): boolean {
  if (state.hazards.length >= GAMEPLAY.maxHazards) {
    return false;
  }

  state.hazards.push({
    id: takeEntityId(state),
    kind: "full-access",
    label: "FULL ACCESS",
    position: clampRectangleCenter(target, hitbox, state.arena),
    hitbox,
    phase: "telegraph",
    remainingMs: GAMEPLAY.fullAccessTelegraphMs,
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

  const width = state.arena.width * randomBetween(
    state,
    difficulty.blackoutWidthRatio[0],
    difficulty.blackoutWidthRatio[1],
  );
  const height = state.arena.height * randomBetween(
    state,
    difficulty.blackoutHeightRatio[0],
    difficulty.blackoutHeightRatio[1],
  );
  const hitbox = { width, height };
  let position = randomRectangleCenter(state, hitbox);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (!state.blackouts.some((blackout) => blackoutOverlapRatio(
      position,
      hitbox,
      blackout.position,
      blackout.hitbox,
    ) > 0.72)) {
      break;
    }
    position = randomRectangleCenter(state, hitbox);
  }

  state.blackouts.push({
    id: takeEntityId(state),
    position,
    hitbox,
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

function fitFullAccessHitbox(
  hitbox: RectangleHitbox,
  arena: ArenaBounds,
): RectangleHitbox {
  return {
    width: Math.max(
      1,
      Math.min(
        hitbox.width,
        arena.width * GAMEPLAY.fullAccessMaxViewportWidthRatio,
      ),
    ),
    height: Math.max(
      1,
      Math.min(
        hitbox.height,
        arena.height * GAMEPLAY.fullAccessMaxViewportHeightRatio,
      ),
    ),
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

function findHitSource(state: GameState): HitSource | null {
  for (const projectile of state.projectiles) {
    if (
      projectile.telegraphRemainingMs <= 0 &&
      circleOverlapsOrientedRectangle(
        state.player.position,
        GAMEPLAY.playerRadius,
        projectile.position,
        projectile.hitbox,
        projectile.velocity,
      )
    ) {
      return projectile.kind;
    }
  }

  for (const wave of state.reasoningWaves) {
    if (reasoningWaveHitsPlayer(wave, state.player.position)) {
      return "reasoning";
    }
  }

  for (const hazard of state.hazards) {
    if (
      hazard.kind === "full-access" &&
      hazard.phase === "active" &&
      circleOverlapsOrientedRectangle(
        state.player.position,
        GAMEPLAY.playerRadius,
        hazard.position,
        hazard.hitbox,
        { x: 1, y: 0 },
      )
    ) {
      return "approval";
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
        return "approval";
      }
    }
  }

  for (const retry of state.retryChains) {
    if (
      retry.telegraphRemainingMs <= 0 &&
      circleOverlapsOrientedRectangle(
        state.player.position,
        GAMEPLAY.playerRadius,
        retry.position,
        retry.hitbox,
        retry.velocity,
      )
    ) {
      return "retry";
    }
  }

  return null;
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

function takeEntityId(state: GameState): number {
  const id = state.nextEntityId;
  state.nextEntityId += 1;
  return id;
}

function finishRun(
  state: GameState,
  source: HitSource,
  events: GameEvent[],
): void {
  if (state.phase !== "playing") {
    return;
  }

  state.phase = "results";
  state.lastHitSource = source;
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
