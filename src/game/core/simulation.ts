import {
  ARENA,
  GAMEPLAY,
  RUN_DURATION_MS,
  STARTING_LIVES,
} from "../constants";
import {
  circlesOverlap,
  directionBetween,
  distanceSquared,
  normalize,
  rotateToward,
  wrap,
} from "./math";
import type {
  EnemyKind,
  EnemyState,
  GameEvent,
  GameState,
  InputIntent,
  TokenState,
  TrailPoint,
  Vec2,
} from "./model";
import { nextRandom, normalizeSeed } from "./random";
import {
  compactRadius,
  compactScore,
  desiredTrailPoints,
  difficultyAt,
  survivalBonus,
} from "./rules";

const PLAYER_START: Vec2 = { x: 640, y: 390 };
const PLAYER_START_DIRECTION: Vec2 = { x: 1, y: 0 };

const ENEMY_RADIUS: Record<EnemyKind, number> = {
  tab: 12,
  leak: 20,
  notification: 16,
};

export const EMPTY_INPUT: InputIntent = {
  direction: null,
  compactPressed: false,
};

function createBaseTrail(): TrailPoint[] {
  return Array.from({ length: GAMEPLAY.baseTrailPoints }, (_, index) => ({
    id: index + 1,
    x:
      PLAYER_START.x -
      (GAMEPLAY.baseTrailPoints - index - 1) * GAMEPLAY.trailSampleDistance,
    y: PLAYER_START.y,
  }));
}

export function createGameState(seed: number): GameState {
  const normalizedSeed = normalizeSeed(seed);
  const trail = createBaseTrail();

  return {
    phase: "ready",
    endReason: null,
    seed: normalizedSeed,
    rngState: normalizedSeed,
    nextEntityId: 1,
    nextTrailId: trail.length + 1,
    elapsedMs: 0,
    remainingMs: RUN_DURATION_MS,
    score: 0,
    pendingTokens: 0,
    overflowRemainingMs: null,
    lives: STARTING_LIVES,
    compactCount: 0,
    tokensCollected: 0,
    enemiesDestroyed: 0,
    player: {
      position: { ...PLAYER_START },
      direction: { ...PLAYER_START_DIRECTION },
      invulnerableMs: 0,
    },
    trail,
    tokens: [],
    enemies: [],
    tokenSpawnRemainingMs: GAMEPLAY.tokenSpawnIntervalMs,
    enemySpawn: {
      tabMs: GAMEPLAY.tabFirstSpawnMs,
      leakMs: GAMEPLAY.leakFirstSpawnMs,
      notificationMs: GAMEPLAY.notificationFirstSpawnMs,
    },
  };
}

export function startRun(state: GameState): GameEvent[] {
  if (state.phase !== "ready") {
    return [];
  }

  state.phase = "playing";

  while (state.tokens.length < GAMEPLAY.startingTokenCount) {
    if (!spawnToken(state)) {
      break;
    }
  }

  return [{ type: "run-started" }];
}

export function restartRun(seed: number): GameState {
  const state = createGameState(seed);
  startRun(state);
  return state;
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
  const stepSeconds = stepMs / 1_000;

  state.player.invulnerableMs = Math.max(
    0,
    state.player.invulnerableMs - stepMs,
  );

  movePlayer(state, intent.direction, stepSeconds);
  collectTokens(state, events);

  if (intent.compactPressed) {
    performCompact(state, events);
  }

  updateEnemies(state, stepMs, stepSeconds);
  resolveEnemyCollisions(state, events);
  resolveOverflow(state, stepMs, events);

  if (state.lives <= 0) {
    finishRun(state, "lives", events);
    return events;
  }

  replenishTokens(state, stepMs);
  spawnScheduledEnemies(state, stepMs);

  state.elapsedMs = Math.min(RUN_DURATION_MS, state.elapsedMs + stepMs);
  state.remainingMs = Math.max(0, RUN_DURATION_MS - state.elapsedMs);

  if (state.remainingMs <= 0.001) {
    state.remainingMs = 0;
    finishRun(state, "time", events);
  }

  return events;
}

function movePlayer(
  state: GameState,
  requestedDirection: Vec2 | null,
  stepSeconds: number,
): void {
  if (requestedDirection && Math.hypot(requestedDirection.x, requestedDirection.y) > 0) {
    state.player.direction = rotateToward(
      state.player.direction,
      normalize(requestedDirection, state.player.direction),
      GAMEPLAY.playerTurnSpeed * stepSeconds,
    );
  }

  state.player.position.x = wrap(
    state.player.position.x +
      state.player.direction.x * GAMEPLAY.playerSpeed * stepSeconds,
    ARENA.left,
    ARENA.right,
  );
  state.player.position.y = wrap(
    state.player.position.y +
      state.player.direction.y * GAMEPLAY.playerSpeed * stepSeconds,
    ARENA.top,
    ARENA.bottom,
  );

  sampleTrail(state);
}

function sampleTrail(state: GameState): void {
  const latest = state.trail.at(-1);

  if (
    !latest ||
    distanceSquared(latest, state.player.position) >=
      GAMEPLAY.trailSampleDistance * GAMEPLAY.trailSampleDistance
  ) {
    state.trail.push({
      id: state.nextTrailId,
      ...state.player.position,
    });
    state.nextTrailId += 1;
  }

  trimTrail(state);
}

function trimTrail(state: GameState): void {
  const excess = state.trail.length - desiredTrailPoints(state.pendingTokens);

  if (excess > 0) {
    state.trail.splice(0, excess);
  }
}

function collectTokens(state: GameState, events: GameEvent[]): void {
  const keptTokens: TokenState[] = [];
  let overflowStarted = false;

  for (const token of state.tokens) {
    const canCollect = state.pendingTokens < GAMEPLAY.contextCapacity;
    const collected =
      canCollect &&
      circlesOverlap(
        state.player.position,
        GAMEPLAY.playerRadius,
        token.position,
        token.radius,
      );

    if (!collected) {
      keptTokens.push(token);
      continue;
    }

    state.pendingTokens += 1;
    state.tokensCollected += 1;
    events.push({
      type: "token-collected",
      tokenId: token.id,
      pendingTokens: state.pendingTokens,
    });

    if (state.pendingTokens === GAMEPLAY.contextCapacity) {
      state.overflowRemainingMs = GAMEPLAY.overflowGraceMs;
      overflowStarted = true;
    }
  }

  state.tokens = keptTokens;

  if (overflowStarted) {
    events.push({ type: "overflow-started" });
  }
}

function performCompact(state: GameState, events: GameEvent[]): void {
  if (state.pendingTokens <= 0) {
    return;
  }

  const tokenCount = state.pendingTokens;
  const bankedScore = compactScore(tokenCount);
  const radius = compactRadius(tokenCount);
  const radiusSquared = radius * radius;
  const destroyed = state.enemies.filter(
    (enemy) => distanceSquared(enemy.position, state.player.position) <= radiusSquared,
  );
  const destroyedIds = new Set(destroyed.map((enemy) => enemy.id));

  state.score += bankedScore;
  state.pendingTokens = 0;
  state.overflowRemainingMs = null;
  state.compactCount += 1;
  state.enemiesDestroyed += destroyed.length;
  state.enemies = state.enemies.filter((enemy) => !destroyedIds.has(enemy.id));
  trimTrail(state);

  events.push({
    type: "compacted",
    bankedScore,
    tokenCount,
    radius,
    clearedEnemies: destroyed.length,
  });

  for (const enemy of destroyed) {
    events.push({
      type: "enemy-destroyed",
      enemyId: enemy.id,
      kind: enemy.kind,
    });
  }
}

function updateEnemies(
  state: GameState,
  stepMs: number,
  stepSeconds: number,
): void {
  const difficulty = difficultyAt(state.elapsedMs);
  const survivors: EnemyState[] = [];
  const splitChildren: EnemyState[] = [];

  for (const enemy of state.enemies) {
    enemy.ageMs += stepMs;
    enemy.behaviorMs -= stepMs;

    if (enemy.kind === "tab") {
      moveChaser(enemy, state.player.position, difficulty.tabSpeed, stepSeconds);
      survivors.push(enemy);
      continue;
    }

    if (enemy.kind === "leak") {
      moveChaser(enemy, state.player.position, difficulty.leakSpeed, stepSeconds);

      if (enemy.behaviorMs <= 0) {
        for (let index = 0; index < 3; index += 1) {
          const angle = (Math.PI * 2 * index) / 3;
          splitChildren.push(
            createEnemy(state, "tab", enemy.position, {
              x: Math.cos(angle),
              y: Math.sin(angle),
            }),
          );
        }
      } else {
        survivors.push(enemy);
      }

      continue;
    }

    if (enemy.notificationMode === "telegraph") {
      enemy.velocity = directionBetween(enemy.position, state.player.position);

      if (enemy.behaviorMs <= 0) {
        enemy.notificationMode = "dash";
        enemy.behaviorMs = GAMEPLAY.notificationDashMs;
      }

      survivors.push(enemy);
      continue;
    }

    enemy.position.x += enemy.velocity.x * difficulty.notificationSpeed * stepSeconds;
    enemy.position.y += enemy.velocity.y * difficulty.notificationSpeed * stepSeconds;

    if (enemy.behaviorMs > 0 && isNearArena(enemy.position, 80)) {
      survivors.push(enemy);
    }
  }

  const availableSlots = Math.max(0, GAMEPLAY.maxEnemies - survivors.length);
  state.enemies = survivors.concat(splitChildren.slice(0, availableSlots));
}

function moveChaser(
  enemy: EnemyState,
  target: Vec2,
  speed: number,
  stepSeconds: number,
): void {
  const targetDirection = directionBetween(enemy.position, target);
  enemy.velocity = rotateToward(enemy.velocity, targetDirection, 3 * stepSeconds);
  enemy.position.x = wrap(
    enemy.position.x + enemy.velocity.x * speed * stepSeconds,
    ARENA.left,
    ARENA.right,
  );
  enemy.position.y = wrap(
    enemy.position.y + enemy.velocity.y * speed * stepSeconds,
    ARENA.top,
    ARENA.bottom,
  );
}

function resolveEnemyCollisions(state: GameState, events: GameEvent[]): void {
  if (state.player.invulnerableMs > 0) {
    return;
  }

  const collided = state.enemies.filter(
    (enemy) => canEnemyHit(enemy) && enemyTouchesPlayerOrDangerousTrail(state, enemy),
  );

  if (collided.length === 0) {
    return;
  }

  const collidedIds = new Set(collided.map((enemy) => enemy.id));
  state.enemies = state.enemies.filter((enemy) => !collidedIds.has(enemy.id));
  applyPlayerHit(state, collided[0]?.kind ?? "tab", events);
}

function canEnemyHit(enemy: EnemyState): boolean {
  return !(
    enemy.kind === "notification" && enemy.notificationMode === "telegraph"
  );
}

function enemyTouchesPlayerOrDangerousTrail(
  state: GameState,
  enemy: EnemyState,
): boolean {
  if (
    circlesOverlap(
      state.player.position,
      GAMEPLAY.playerRadius,
      enemy.position,
      enemy.radius,
    )
  ) {
    return true;
  }

  const dangerousTrailPoints = Math.max(
    0,
    state.trail.length - GAMEPLAY.baseTrailPoints,
  );

  for (let index = 0; index < dangerousTrailPoints; index += 2) {
    const point = state.trail[index];

    if (point && circlesOverlap(point, 6, enemy.position, enemy.radius)) {
      return true;
    }
  }

  return false;
}

function resolveOverflow(
  state: GameState,
  stepMs: number,
  events: GameEvent[],
): void {
  if (state.overflowRemainingMs === null) {
    return;
  }

  state.overflowRemainingMs = Math.max(0, state.overflowRemainingMs - stepMs);

  if (
    state.overflowRemainingMs <= 0 &&
    state.pendingTokens >= GAMEPLAY.contextCapacity
  ) {
    applyPlayerHit(state, "overflow", events);
  }
}

function applyPlayerHit(
  state: GameState,
  source: EnemyKind | "overflow",
  events: GameEvent[],
): void {
  state.lives = Math.max(0, state.lives - 1);
  state.pendingTokens = 0;
  state.overflowRemainingMs = null;
  state.player.invulnerableMs = GAMEPLAY.invulnerabilityMs;
  trimTrail(state);
  events.push({ type: "player-hit", source, lives: state.lives });
}

function replenishTokens(state: GameState, stepMs: number): void {
  if (state.tokens.length >= GAMEPLAY.tokenTargetCount) {
    state.tokenSpawnRemainingMs = GAMEPLAY.tokenSpawnIntervalMs;
    return;
  }

  state.tokenSpawnRemainingMs -= stepMs;

  if (state.tokenSpawnRemainingMs <= 0) {
    spawnToken(state);
    state.tokenSpawnRemainingMs += GAMEPLAY.tokenSpawnIntervalMs;
  }
}

function spawnToken(state: GameState): boolean {
  for (let attempt = 0; attempt < GAMEPLAY.enemySpawnAttempts; attempt += 1) {
    const position = {
      x: randomBetween(state, ARENA.left + 32, ARENA.right - 32),
      y: randomBetween(state, ARENA.top + 32, ARENA.bottom - 32),
    };
    const awayFromPlayer =
      distanceSquared(position, state.player.position) >= 100 * 100;
    const awayFromTokens = state.tokens.every(
      (token) => distanceSquared(position, token.position) >= 30 * 30,
    );

    if (!awayFromPlayer || !awayFromTokens) {
      continue;
    }

    state.tokens.push({
      id: takeEntityId(state),
      position,
      radius: GAMEPLAY.tokenRadius,
    });
    return true;
  }

  return false;
}

function spawnScheduledEnemies(state: GameState, stepMs: number): void {
  const difficulty = difficultyAt(state.elapsedMs);
  state.enemySpawn.tabMs -= stepMs;
  state.enemySpawn.leakMs -= stepMs;
  state.enemySpawn.notificationMs -= stepMs;

  if (state.enemySpawn.tabMs <= 0) {
    trySpawnEnemy(state, "tab");
    state.enemySpawn.tabMs += difficulty.tabIntervalMs;
  }

  if (state.enemySpawn.leakMs <= 0) {
    trySpawnEnemy(state, "leak");
    state.enemySpawn.leakMs += difficulty.leakIntervalMs;
  }

  if (state.enemySpawn.notificationMs <= 0) {
    trySpawnEnemy(state, "notification");
    state.enemySpawn.notificationMs += difficulty.notificationIntervalMs;
  }
}

function trySpawnEnemy(state: GameState, kind: EnemyKind): boolean {
  if (state.enemies.length >= GAMEPLAY.maxEnemies) {
    return false;
  }

  for (let attempt = 0; attempt < GAMEPLAY.enemySpawnAttempts; attempt += 1) {
    const position = randomEdgePosition(state);

    if (
      distanceSquared(position, state.player.position) <
      GAMEPLAY.enemySpawnSafeDistance * GAMEPLAY.enemySpawnSafeDistance
    ) {
      continue;
    }

    state.enemies.push(
      createEnemy(state, kind, position, directionBetween(position, state.player.position)),
    );
    return true;
  }

  return false;
}

function randomEdgePosition(state: GameState): Vec2 {
  const edge = Math.floor(randomBetween(state, 0, 4));

  if (edge === 0) {
    return { x: ARENA.left, y: randomBetween(state, ARENA.top, ARENA.bottom) };
  }

  if (edge === 1) {
    return { x: ARENA.right, y: randomBetween(state, ARENA.top, ARENA.bottom) };
  }

  if (edge === 2) {
    return { x: randomBetween(state, ARENA.left, ARENA.right), y: ARENA.top };
  }

  return { x: randomBetween(state, ARENA.left, ARENA.right), y: ARENA.bottom };
}

function createEnemy(
  state: GameState,
  kind: EnemyKind,
  position: Vec2,
  velocity: Vec2,
): EnemyState {
  return {
    id: takeEntityId(state),
    kind,
    position: { ...position },
    velocity: normalize(velocity),
    radius: ENEMY_RADIUS[kind],
    ageMs: 0,
    behaviorMs:
      kind === "leak"
        ? GAMEPLAY.leakSplitMs
        : kind === "notification"
          ? GAMEPLAY.notificationTelegraphMs
          : 0,
    notificationMode: kind === "notification" ? "telegraph" : null,
  };
}

function isNearArena(position: Vec2, margin: number): boolean {
  return (
    position.x >= ARENA.left - margin &&
    position.x <= ARENA.right + margin &&
    position.y >= ARENA.top - margin &&
    position.y <= ARENA.bottom + margin
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
  reason: "time" | "lives",
  events: GameEvent[],
): void {
  if (state.phase !== "playing") {
    return;
  }

  const bonus = reason === "time" ? survivalBonus(state.lives) : 0;
  state.score += bonus;
  state.phase = "results";
  state.endReason = reason;
  events.push({
    type: "run-ended",
    reason,
    finalScore: state.score,
    survivalBonus: bonus,
  });
}
