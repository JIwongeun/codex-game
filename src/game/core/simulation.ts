import { ARENA, GAMEPLAY } from "../constants";
import {
  clamp,
  circlesOverlap,
  directionBetween,
  normalize,
} from "./math";
import type {
  AreaHazardState,
  GameEvent,
  GameState,
  HitSource,
  InputIntent,
  ProjectileKind,
  ProjectileState,
  SweepAxis,
  Vec2,
} from "./model";
import { nextRandom, normalizeSeed } from "./random";
import { difficultyAt } from "./rules";

const PLAYER_START: Vec2 = { x: 640, y: 390 };
const PLAYER_START_DIRECTION: Vec2 = { x: 1, y: 0 };

export const EMPTY_INPUT: InputIntent = { direction: null };

export function createGameState(seed: number): GameState {
  const normalizedSeed = normalizeSeed(seed);

  return {
    phase: "ready",
    seed: normalizedSeed,
    rngState: normalizedSeed,
    nextEntityId: 1,
    elapsedMs: 0,
    score: 0,
    attacksDodged: 0,
    hazardsSurvived: 0,
    lastHitSource: null,
    player: {
      position: { ...PLAYER_START },
      direction: { ...PLAYER_START_DIRECTION },
    },
    projectiles: [],
    hazards: [],
    spawn: {
      tabMs: GAMEPLAY.tabFirstSpawnMs,
      popupMs: GAMEPLAY.popupFirstSpawnMs,
      memoryLeakMs: GAMEPLAY.memoryLeakFirstSpawnMs,
      contextSweepMs: GAMEPLAY.contextSweepFirstSpawnMs,
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
  state.elapsedMs += stepMs;
  state.score = Math.floor(state.elapsedMs);

  movePlayer(state, intent.direction, stepSeconds);
  updateProjectiles(state, stepMs, stepSeconds);
  updateHazards(state, stepMs, events);
  spawnScheduledAttacks(state, stepMs, events);

  const hitSource = findHitSource(state);
  if (hitSource) {
    finishRun(state, hitSource, events);
  }

  return events;
}

function movePlayer(
  state: GameState,
  requestedDirection: Vec2 | null,
  stepSeconds: number,
): void {
  if (!requestedDirection || Math.hypot(requestedDirection.x, requestedDirection.y) <= 0) {
    return;
  }

  const direction = normalize(requestedDirection, state.player.direction);
  state.player.direction = direction;
  state.player.position.x = clamp(
    state.player.position.x + direction.x * GAMEPLAY.playerSpeed * stepSeconds,
    ARENA.left + GAMEPLAY.playerRadius,
    ARENA.right - GAMEPLAY.playerRadius,
  );
  state.player.position.y = clamp(
    state.player.position.y + direction.y * GAMEPLAY.playerSpeed * stepSeconds,
    ARENA.top + GAMEPLAY.playerRadius,
    ARENA.bottom - GAMEPLAY.playerRadius,
  );
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
      projectile.velocity = directionBetween(
        projectile.position,
        state.player.position,
      );
    } else {
      projectile.position.x += projectile.velocity.x * projectile.speed * stepSeconds;
      projectile.position.y += projectile.velocity.y * projectile.speed * stepSeconds;
    }

    if (isInsideProjectileBounds(projectile.position)) {
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
        hazard.kind === "memory-leak"
          ? GAMEPLAY.memoryLeakActiveMs
          : GAMEPLAY.contextSweepActiveMs;
      survivors.push(hazard);
      events.push({ type: "hazard-activated", kind: hazard.kind });
    } else {
      state.hazardsSurvived += 1;
    }
  }

  state.hazards = survivors;
}

function spawnScheduledAttacks(
  state: GameState,
  stepMs: number,
  events: GameEvent[],
): void {
  const difficulty = difficultyAt(state.elapsedMs);
  state.spawn.tabMs -= stepMs;
  state.spawn.popupMs -= stepMs;
  state.spawn.memoryLeakMs -= stepMs;
  state.spawn.contextSweepMs -= stepMs;

  if (state.spawn.tabMs <= 0) {
    for (let index = 0; index < difficulty.tabBurst; index += 1) {
      spawnProjectile(state, "tab", difficulty.tabSpeed);
    }
    state.spawn.tabMs += difficulty.tabIntervalMs;
  }

  if (difficulty.popupUnlocked && state.spawn.popupMs <= 0) {
    spawnProjectile(state, "popup", difficulty.popupSpeed);
    state.spawn.popupMs += difficulty.popupIntervalMs;
  }

  if (difficulty.memoryLeakUnlocked && state.spawn.memoryLeakMs <= 0) {
    if (spawnMemoryLeak(state, difficulty.memoryLeakRadius)) {
      events.push({ type: "hazard-warning", kind: "memory-leak" });
    }
    state.spawn.memoryLeakMs += difficulty.memoryLeakIntervalMs;
  }

  if (difficulty.contextSweepUnlocked && state.spawn.contextSweepMs <= 0) {
    if (spawnContextSweep(state, difficulty.contextSweepThickness)) {
      events.push({ type: "hazard-warning", kind: "context-sweep" });
    }
    state.spawn.contextSweepMs += difficulty.contextSweepIntervalMs;
  }
}

function spawnProjectile(
  state: GameState,
  kind: ProjectileKind,
  speed: number,
): boolean {
  if (state.projectiles.length >= GAMEPLAY.maxProjectiles) {
    return false;
  }

  const position = randomEdgePosition(state);
  const aimJitter = kind === "tab" ? 90 : 30;
  const target = {
    x: clamp(
      state.player.position.x + randomBetween(state, -aimJitter, aimJitter),
      ARENA.left,
      ARENA.right,
    ),
    y: clamp(
      state.player.position.y + randomBetween(state, -aimJitter, aimJitter),
      ARENA.top,
      ARENA.bottom,
    ),
  };

  state.projectiles.push({
    id: takeEntityId(state),
    kind,
    position,
    velocity: directionBetween(position, target),
    radius: kind === "tab" ? GAMEPLAY.projectileRadius : GAMEPLAY.popupRadius,
    speed,
    ageMs: 0,
    telegraphRemainingMs: kind === "popup" ? GAMEPLAY.popupTelegraphMs : 0,
  });
  return true;
}

function spawnMemoryLeak(state: GameState, radius: number): boolean {
  if (state.hazards.length >= GAMEPLAY.maxHazards) {
    return false;
  }

  const position = {
    x: clamp(
      state.player.position.x + randomBetween(state, -130, 130),
      ARENA.left + radius,
      ARENA.right - radius,
    ),
    y: clamp(
      state.player.position.y + randomBetween(state, -110, 110),
      ARENA.top + radius,
      ARENA.bottom - radius,
    ),
  };

  state.hazards.push({
    id: takeEntityId(state),
    kind: "memory-leak",
    position,
    radius,
    axis: null,
    thickness: 0,
    phase: "telegraph",
    remainingMs: GAMEPLAY.memoryLeakTelegraphMs,
  });
  return true;
}

function spawnContextSweep(state: GameState, thickness: number): boolean {
  if (state.hazards.length >= GAMEPLAY.maxHazards) {
    return false;
  }

  const axis: SweepAxis = randomBetween(state, 0, 1) < 0.5 ? "horizontal" : "vertical";
  const position =
    axis === "horizontal"
      ? {
          x: (ARENA.left + ARENA.right) / 2,
          y: randomBetween(
            state,
            ARENA.top + thickness / 2,
            ARENA.bottom - thickness / 2,
          ),
        }
      : {
          x: randomBetween(
            state,
            ARENA.left + thickness / 2,
            ARENA.right - thickness / 2,
          ),
          y: (ARENA.top + ARENA.bottom) / 2,
        };

  state.hazards.push({
    id: takeEntityId(state),
    kind: "context-sweep",
    position,
    radius: 0,
    axis,
    thickness,
    phase: "telegraph",
    remainingMs: GAMEPLAY.contextSweepTelegraphMs,
  });
  return true;
}

function findHitSource(state: GameState): HitSource | null {
  for (const projectile of state.projectiles) {
    if (
      projectile.telegraphRemainingMs <= 0 &&
      circlesOverlap(
        state.player.position,
        GAMEPLAY.playerRadius,
        projectile.position,
        projectile.radius,
      )
    ) {
      return projectile.kind;
    }
  }

  for (const hazard of state.hazards) {
    if (hazard.phase !== "active") {
      continue;
    }

    if (
      hazard.kind === "memory-leak" &&
      circlesOverlap(
        state.player.position,
        GAMEPLAY.playerRadius,
        hazard.position,
        hazard.radius,
      )
    ) {
      return hazard.kind;
    }

    if (hazard.kind === "context-sweep" && sweepTouchesPlayer(hazard, state.player.position)) {
      return hazard.kind;
    }
  }

  return null;
}

function sweepTouchesPlayer(hazard: AreaHazardState, player: Vec2): boolean {
  const halfThickness = hazard.thickness / 2;

  return hazard.axis === "horizontal"
    ? Math.abs(player.y - hazard.position.y) <= halfThickness + GAMEPLAY.playerRadius
    : Math.abs(player.x - hazard.position.x) <= halfThickness + GAMEPLAY.playerRadius;
}

function randomEdgePosition(state: GameState): Vec2 {
  const edge = Math.floor(randomBetween(state, 0, 4));
  const margin = GAMEPLAY.projectileMargin;

  if (edge === 0) {
    return { x: ARENA.left - margin, y: randomBetween(state, ARENA.top, ARENA.bottom) };
  }
  if (edge === 1) {
    return { x: ARENA.right + margin, y: randomBetween(state, ARENA.top, ARENA.bottom) };
  }
  if (edge === 2) {
    return { x: randomBetween(state, ARENA.left, ARENA.right), y: ARENA.top - margin };
  }
  return { x: randomBetween(state, ARENA.left, ARENA.right), y: ARENA.bottom + margin };
}

function isInsideProjectileBounds(position: Vec2): boolean {
  const margin = GAMEPLAY.projectileMargin * 1.5;
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
