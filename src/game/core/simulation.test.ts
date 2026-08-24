import { describe, expect, it } from "vitest";

import { FIXED_STEP_MS, GAMEPLAY } from "../constants";
import type {
  ApprovalGateState,
  AreaHazardState,
  AttackSequenceState,
  GameState,
  ProjectileState,
  ReasoningWaveState,
  RetryChainState,
} from "./model";
import {
  createGameState,
  EMPTY_INPUT,
  resizeArena,
  restartRun,
  startRun,
  stepGame,
} from "./simulation";
import { approvalGateGapSize } from "./approvalGate";

function playingState(seed = 1, width = 1280, height = 720): GameState {
  const state = createGameState(seed, width, height);
  startRun(state);
  state.spawn = {
    toolCallMs: 1_000_000,
    approvalMs: 1_000_000,
    compactionMs: 1_000_000,
    downloadAccessMs: 1_000_000,
    retryLoopMs: 1_000_000,
    reasoningMs: 1_000_000,
    parallelAgentsMs: 1_000_000,
    reviewLoopMs: 1_000_000,
    usageLimitMs: 1_000_000,
    blackoutMs: 1_000_000,
    majorPatternCooldownMs: 0,
    majorPatternCursor: 0,
  };
  return state;
}

function approvalGate(
  state: GameState,
  overrides: Partial<ApprovalGateState> = {},
): ApprovalGateState {
  return {
    id: 250,
    position: { x: state.player.position.x, y: 0 },
    direction: { x: 1, y: 0 },
    gaps: [
      {
        center: state.player.position.y + 120,
        size: 90,
        label: "DENY",
      },
    ],
    thickness: GAMEPLAY.approvalGateThickness,
    speed: 0,
    telegraphRemainingMs: FIXED_STEP_MS * 2,
    ...overrides,
  };
}

function retryChain(
  overrides: Partial<RetryChainState> = {},
): RetryChainState {
  return {
    id: 275,
    position: { x: 100, y: 100 },
    target: { x: 200, y: 100 },
    velocity: { x: 1, y: 0 },
    hitbox: {
      width: GAMEPLAY.retryChainHitboxWidth,
      height: GAMEPLAY.retryChainHitboxHeight,
    },
    speed: 100,
    attempt: 1,
    totalAttempts: 3,
    telegraphRemainingMs: 0,
    completionRemainingMs: 0,
    ...overrides,
  };
}

function reasoningWave(
  state: GameState,
  overrides: Partial<ReasoningWaveState> = {},
): ReasoningWaveState {
  return {
    id: 290,
    center: { ...state.player.position },
    safeAngle: 0,
    safeArc: Math.PI / 2,
    radius: 200,
    previousRadius: 200,
    maxRadius: 500,
    thickness: GAMEPLAY.reasoningWaveThickness,
    speed: 1_000,
    collapseDurationMs: 500,
    phase: "active",
    telegraphRemainingMs: 0,
    telegraphDurationMs: GAMEPLAY.reasoningTelegraphMs,
    ...overrides,
  };
}

function projectile(
  state: GameState,
  overrides: Partial<ProjectileState> = {},
): ProjectileState {
  return {
    id: 100,
    kind: "tool-call",
    surface: "terminal",
    label: "error: CI failed",
    position: { ...state.player.position },
    velocity: { x: 1, y: 0 },
    hitbox: {
      width: GAMEPLAY.toolCallHitboxMinWidth,
      height: GAMEPLAY.toolCallHitboxHeight,
    },
    speed: 0,
    ageMs: 0,
    telegraphRemainingMs: 0,
    blackoutRevealGraceRemainingMs: 0,
    ...overrides,
  };
}

function hazard(
  state: GameState,
  overrides: Partial<AreaHazardState> = {},
): AreaHazardState {
  return {
    id: 200,
    kind: "compaction",
    label: "CONTEXT COMPACTION",
    position: { ...state.player.position },
    hitbox: { width: 180, height: 180 },
    phase: "telegraph",
    remainingMs: FIXED_STEP_MS * 2,
    ...overrides,
  };
}

function sequence(
  overrides: Partial<AttackSequenceState> = {},
): AttackSequenceState {
  return {
    id: 300,
    kind: "review-loop",
    label: "[review] fixing findings",
    position: { x: 160, y: 140 },
    origins: [{ x: 0, y: 140 }],
    remainingMs: FIXED_STEP_MS,
    durationMs: GAMEPLAY.reviewLoopConvergeMs,
    projectileCount: 8,
    projectileSpeed: 320,
    resultLabel: "ONE MORE ISSUE",
    ...overrides,
  };
}

describe("survival simulation", () => {
  it("starts anonymously with a deterministic viewport-sized arena", () => {
    const first = createGameState(42, 1024, 768);
    const second = createGameState(42, 1024, 768);

    expect(startRun(first)).toEqual([{ type: "run-started" }]);
    startRun(second);

    expect(first.phase).toBe("playing");
    expect(first.arena).toEqual({ width: 1024, height: 768 });
    expect(first.player.position).toEqual({ x: 512, y: 384 });
    expect(first.projectiles).toEqual([]);
    expect(first.hazards).toEqual([]);
    expect(first.sequences).toEqual([]);
    expect(first.approvalGates).toEqual([]);
    expect(first.retryChains).toEqual([]);
    expect(first.reasoningWaves).toEqual([]);
    expect(first.blackouts).toEqual([]);
    expect(first.ending).toBeNull();
    expect(first).toEqual(second);
    expect(startRun(first)).toEqual([]);
  });

  it("produces identical state for the same seed and keyboard stream", () => {
    const first = restartRun(314_159, 960, 640);
    const second = restartRun(314_159, 960, 640);

    for (let tick = 0; tick < 900 && first.phase === "playing"; tick += 1) {
      const intent = {
        direction: {
          x: Math.cos(tick / 90),
          y: Math.sin(tick / 90),
        },
      };
      stepGame(first, intent, FIXED_STEP_MS);
      stepGame(second, intent, FIXED_STEP_MS);
    }

    expect(first).toEqual(second);
  });

  it("spawns tool-call paths independently from the player position", () => {
    const first = playingState(9, 800, 600);
    const second = playingState(9, 800, 600);
    first.player.position = { x: 100, y: 120 };
    second.player.position = { x: 700, y: 480 };
    first.spawn.toolCallMs = 0;
    second.spawn.toolCallMs = 0;

    stepGame(first, EMPTY_INPUT, FIXED_STEP_MS);
    stepGame(second, EMPTY_INPUT, FIXED_STEP_MS);

    expect(first.projectiles).toEqual(second.projectiles);
    expect(first.rngState).toBe(second.rngState);

    const spawned = first.projectiles[0];
    expect(spawned?.kind).toBe("tool-call");
    if (!spawned) {
      throw new Error("expected a tool-call projectile");
    }

    const crossesViewport =
      (spawned.position.x < 0 && spawned.velocity.x > 0) ||
      (spawned.position.x > first.arena.width && spawned.velocity.x < 0) ||
      (spawned.position.y < 0 && spawned.velocity.y > 0) ||
      (spawned.position.y > first.arena.height && spawned.velocity.y < 0);
    expect(crossesViewport).toBe(true);

    const initialVelocity = { ...spawned.velocity };
    first.player.position = { x: 400, y: 300 };
    stepGame(first, EMPTY_INPUT, FIXED_STEP_MS);
    expect(spawned.velocity).toEqual(initialVelocity);
  });

  it.each([5, 6, 9, 10])(
    "keeps the baseline tool stream to one command at stage %i",
    (stage) => {
      const state = playingState(stage, 800, 600);
      state.elapsedMs = GAMEPLAY.stageDurationMs * (stage - 1);
      state.spawn.toolCallMs = 0;

      stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);

      expect(
        state.projectiles.filter(
          (candidate) => candidate.kind === "tool-call",
        ),
      ).toHaveLength(1);
    },
  );

  it("spawns approval as a slower sweeping wall with three or four fixed gaps", () => {
    const state = playingState(17, 800, 600);
    state.elapsedMs = GAMEPLAY.approvalFirstSpawnMs;
    state.player.position = { x: 190, y: 430 };
    state.spawn.approvalMs = 0;

    stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);

    const spawned = state.approvalGates[0];
    expect(spawned).toBeDefined();
    if (!spawned) {
      throw new Error("expected an approval gate");
    }

    expect(Math.abs(spawned.direction.x) + Math.abs(spawned.direction.y)).toBe(1);
    expect(spawned.gaps.length).toBeGreaterThanOrEqual(3);
    expect(spawned.gaps.length).toBeLessThanOrEqual(4);
    expect(
      spawned.gaps.every(
        ({ label, size }) =>
          size >= GAMEPLAY.approvalGateMinGap &&
          size <= GAMEPLAY.approvalGateMaxGap &&
          size === approvalGateGapSize(label),
      ),
    ).toBe(true);
    const initialGaps = structuredClone(spawned.gaps);
    state.player.position = { x: 760, y: 40 };
    stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);
    expect(spawned.gaps).toEqual(initialGaps);
    expect(spawned.telegraphRemainingMs).toBeLessThan(
      GAMEPLAY.approvalGateTelegraphMs,
    );
  });

  it("snapshots one xhigh center and safe sector while thinking stays harmless", () => {
    const state = playingState(18, 800, 600);
    state.elapsedMs = GAMEPLAY.reasoningFirstSpawnMs;
    state.player.position = { x: 240, y: 410 };
    state.spawn.reasoningMs = 0;

    stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);

    const spawned = state.reasoningWaves[0];
    expect(spawned).toBeDefined();
    if (!spawned) {
      throw new Error("expected an xhigh reasoning wave");
    }

    expect(spawned.center).toEqual({ x: 240, y: 410 });
    expect(spawned.phase).toBe("thinking");
    expect(state.projectiles).toEqual([]);
    expect(spawned.telegraphRemainingMs).toBe(GAMEPLAY.reasoningTelegraphMs);
    expect(spawned.safeArc).toBeCloseTo((85 * Math.PI) / 180, 2);
    const initialSafeAngle = spawned.safeAngle;
    state.player.position = { x: 760, y: 40 };
    stepGame(state, EMPTY_INPUT, GAMEPLAY.reasoningTelegraphMs / 2);
    expect(state.phase).toBe("playing");
    expect(spawned.center).toEqual({ x: 240, y: 410 });
    expect(spawned.safeAngle).toBe(initialSafeAngle);
  });

  it("emits one answer event when xhigh thinking becomes an inward wave", () => {
    const state = playingState(19, 800, 600);
    const wave = reasoningWave(state, {
      phase: "thinking",
      radius: 500,
      previousRadius: 500,
      telegraphRemainingMs: 10,
    });
    state.reasoningWaves = [wave];

    const activationEvents = stepGame(state, EMPTY_INPUT, 10);
    expect(wave.phase).toBe("active");
    expect(wave.radius).toBe(wave.maxRadius);
    expect(activationEvents).toContainEqual({
      type: "pattern-burst",
      kind: "reasoning-xhigh",
      position: wave.center,
    });

    const nextEvents = stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);
    expect(
      nextEvents.filter(
        (event) =>
          event.type === "pattern-burst" && event.kind === "reasoning-xhigh",
      ),
    ).toHaveLength(0);
    expect(wave.radius).toBeLessThan(wave.maxRadius);
  });

  it.each([
    [375, 640],
    [1_920, 1_080],
  ])(
    "keeps xhigh collapse duration stable in a %ix%i viewport",
    (width, height) => {
      const state = playingState(width + height, width, height);
      state.elapsedMs = GAMEPLAY.reasoningFirstSpawnMs;
      state.spawn.reasoningMs = 0;

      stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);

      const wave = state.reasoningWaves[0];
      expect(wave).toBeDefined();
      if (!wave) {
        throw new Error("expected an xhigh reasoning wave");
      }
      expect((wave.maxRadius / wave.speed) * 1_000).toBeCloseTo(
        wave.collapseDurationMs,
      );
      expect(wave.collapseDurationMs).toBeCloseTo(1_000, 0);
    },
  );

  it("recomputes a thinking xhigh wave for the resized viewport", () => {
    const state = playingState(23, 1_920, 1_080);
    state.elapsedMs = GAMEPLAY.reasoningFirstSpawnMs;
    state.spawn.reasoningMs = 0;
    stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);

    const wave = state.reasoningWaves[0];
    expect(wave).toBeDefined();
    if (!wave) {
      throw new Error("expected an xhigh reasoning wave");
    }
    const previousSpeed = wave.speed;

    resizeArena(state, 375, 640);

    expect(wave.phase).toBe("thinking");
    expect(wave.speed).not.toBe(previousSpeed);
    expect((wave.maxRadius / wave.speed) * 1_000).toBeCloseTo(
      wave.collapseDurationMs,
    );
  });

  it("leaves the fixed xhigh safe sector harmless but hits the swept annulus", () => {
    const safeState = playingState(20, 800, 600);
    safeState.player.position = { x: 500, y: 300 };
    safeState.reasoningWaves = [
      reasoningWave(safeState, {
        center: { x: 400, y: 300 },
        radius: 110,
        previousRadius: 110,
      }),
    ];
    stepGame(safeState, EMPTY_INPUT, 20);
    expect(safeState.phase).toBe("playing");

    const dangerState = playingState(20, 800, 600);
    dangerState.player.position = { x: 300, y: 300 };
    dangerState.reasoningWaves = [
      reasoningWave(dangerState, {
        center: { x: 400, y: 300 },
        radius: 110,
        previousRadius: 110,
      }),
    ];
    stepGame(dangerState, EMPTY_INPUT, 20);
    expect(dangerState.phase).toBe("results");
    expect(dangerState.lastHitSource).toBe("reasoning");
  });

  it("cannot tunnel through xhigh or survive its final collapse at center", () => {
    const sweptState = playingState(21, 800, 600);
    sweptState.player.position = { x: 400, y: 150 };
    sweptState.reasoningWaves = [
      reasoningWave(sweptState, {
        center: { x: 400, y: 300 },
        safeAngle: 0,
        radius: 300,
        previousRadius: 300,
      }),
    ];
    stepGame(sweptState, EMPTY_INPUT, 200);
    expect(sweptState.phase).toBe("results");
    expect(sweptState.lastHitSource).toBe("reasoning");

    const centerState = playingState(22, 800, 600);
    centerState.reasoningWaves = [
      reasoningWave(centerState, {
        safeAngle: 0,
        radius: 20,
        previousRadius: 20,
      }),
    ];
    stepGame(centerState, EMPTY_INPUT, 20);
    expect(centerState.phase).toBe("results");
    expect(centerState.lastHitSource).toBe("reasoning");
  });

  it("selects seeded parody labels with bounded label-sized hitboxes", () => {
    const toolCallLabels = new Set<string>();

    for (let seed = 1; seed <= 512; seed += 1) {
      const state = playingState(seed, 800, 600);
      state.elapsedMs = GAMEPLAY.approvalFirstSpawnMs;
      state.spawn.toolCallMs = 0;
      state.spawn.approvalMs = 0;
      stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);

      for (const candidate of state.projectiles) {
        if (candidate.kind === "tool-call") {
          toolCallLabels.add(candidate.label);
          expect(candidate.hitbox.width).toBeGreaterThanOrEqual(
            GAMEPLAY.toolCallHitboxMinWidth,
          );
          expect(candidate.hitbox.width).toBeLessThanOrEqual(
            GAMEPLAY.toolCallHitboxMaxWidth,
          );
        }
      }
    }

    expect(toolCallLabels.size).toBeGreaterThanOrEqual(180);
    expect([...toolCallLabels]).toEqual(
      expect.arrayContaining([
        "$ git add .",
        '$ git commit -m "fix flaky test"',
        "$ git push --force-with-lease",
        "$ npm run build",
        "$ pnpm exec vitest run",
        "$ npx tsc --noEmit",
        "$ cd src/game",
        "$ ls -la",
        "$ rm -r dist",
        "$ Get-Content package.json",
        "[context] compacting conversation",
        "429 Too Many Requests",
      ]),
    );
    const surfaces = new Set<string>();
    for (let seed = 1; seed <= 512; seed += 1) {
      const state = playingState(seed, 800, 600);
      state.spawn.toolCallMs = 0;
      stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);
      for (const candidate of state.projectiles) {
        if (candidate.kind === "tool-call") {
          surfaces.add(candidate.surface);
        }
      }
    }
    expect(surfaces).toEqual(new Set(["terminal", "browser", "codex"]));
  });

  it("moves at a fixed speed, normalizes diagonals, and clamps at viewport edges", () => {
    const state = playingState(1, 800, 600);

    stepGame(state, { direction: { x: 1, y: 0 } }, 500);
    expect(state.player.position).toEqual({ x: 620, y: 300 });

    const beforeDiagonal = { ...state.player.position };
    stepGame(state, { direction: { x: 1, y: 1 } }, 100);
    expect(
      Math.hypot(
        state.player.position.x - beforeDiagonal.x,
        state.player.position.y - beforeDiagonal.y,
      ),
    ).toBeCloseTo(GAMEPLAY.playerSpeed * 0.1);

    stepGame(state, { direction: { x: 1, y: 1 } }, 5_000);
    expect(state.player.position).toEqual({
      x: 800 - GAMEPLAY.playerRadius,
      y: 600 - GAMEPLAY.playerRadius,
    });
  });

  it("resizes the live arena and keeps entities inside valid responsive bounds", () => {
    const state = playingState(1, 1280, 720);
    state.player.position = { x: 1_200, y: 680 };
    state.hazards = [
      hazard(state, {
        position: { x: 1_100, y: 650 },
        hitbox: { width: 280, height: 280 },
      }),
    ];
    state.sequences = [
      sequence({
        position: { x: 1_100, y: 650 },
        origins: [{ x: 1_280, y: 700 }],
      }),
    ];
    state.approvalGates = [
      approvalGate(state, {
        position: { x: 960, y: 0 },
        gaps: [{ center: 360, size: 90, label: "REVIEW" }],
        telegraphRemainingMs: 0,
      }),
    ];
    state.retryChains = [
      retryChain({
        position: { x: 1_200, y: 680 },
        target: { x: 1_270, y: 100 },
        velocity: { x: 1, y: 0 },
      }),
    ];
    state.blackouts = [
      {
        id: 330,
        position: { x: 1_100, y: 500 },
        hitbox: { width: 384, height: 180 },
        telegraphRemainingMs: GAMEPLAY.blackoutTelegraphMs,
        remainingMs: GAMEPLAY.blackoutStageTenDurationMs,
        durationMs: GAMEPLAY.blackoutStageTenDurationMs,
      },
    ];
    state.reasoningWaves = [
      reasoningWave(state, {
        center: { x: 1_200, y: 680 },
        radius: 900,
        previousRadius: 920,
        maxRadius: 1_000,
      }),
    ];
    const remainingCollapseMs =
      (state.reasoningWaves[0]!.radius / state.reasoningWaves[0]!.speed) *
      1_000;

    resizeArena(state, 375, 640);

    expect(state.arena).toEqual({ width: 375, height: 640 });
    expect(state.player.position.x).toBeLessThanOrEqual(
      375 - GAMEPLAY.playerRadius,
    );
    expect(state.player.position.y).toBeLessThanOrEqual(
      640 - GAMEPLAY.playerRadius,
    );
    expect(state.hazards[0]!.position.x).toBeLessThanOrEqual(
      375 - state.hazards[0]!.hitbox.width / 2,
    );
    expect(state.sequences[0]!.position.x).toBeLessThanOrEqual(375 - 36);
    expect(state.sequences[0]!.origins[0]!.x).toBeLessThanOrEqual(375);
    expect(state.approvalGates[0]!.position.x).toBeCloseTo(281.25);
    expect(state.approvalGates[0]!.gaps[0]!.center).toBeCloseTo(320);
    expect(state.approvalGates[0]!.gaps[0]!.size).toBe(
      approvalGateGapSize("REVIEW"),
    );
    expect(state.retryChains[0]!.velocity).toEqual({ x: 0, y: -1 });
    expect(state.blackouts[0]!.hitbox.width / state.arena.width).toBeCloseTo(
      0.3,
    );
    expect(state.blackouts[0]!.hitbox.height / state.arena.height).toBeCloseTo(
      0.25,
    );
    expect(state.blackouts[0]!.position.x).toBeLessThanOrEqual(
      state.arena.width - state.blackouts[0]!.hitbox.width / 2,
    );
    expect(state.reasoningWaves[0]!.center.x).toBeLessThanOrEqual(
      375 - GAMEPLAY.playerRadius,
    );
    expect(state.reasoningWaves[0]!.radius).toBeLessThan(
      state.reasoningWaves[0]!.maxRadius,
    );
    expect(
      (state.reasoningWaves[0]!.radius / state.reasoningWaves[0]!.speed) *
        1_000,
    ).toBeCloseTo(remainingCollapseMs);
  });

  it("does not move without keyboard input", () => {
    const state = playingState();
    const start = { ...state.player.position };

    stepGame(state, EMPTY_INPUT, 1_000);

    expect(state.player.position).toEqual(start);
  });

  it("ends the run on the first projectile collision", () => {
    const state = playingState();
    state.projectiles = [projectile(state)];

    const events = stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);

    expect(state.phase).toBe("results");
    expect(state.lastHitSource).toBe("tool-call");
    expect(events).toContainEqual({ type: "player-hit", source: "tool-call" });
    expect(events.at(-1)).toEqual({
      type: "run-ended",
      finalScore: state.score,
      source: "tool-call",
    });
  });

  it("gives a hidden projectile a short reveal grace after it leaves rm", () => {
    const state = playingState(302, 800, 600);
    state.player.position = { x: 460, y: 300 };
    state.projectiles = [
      projectile(state, {
        position: { x: 440, y: 300 },
        velocity: { x: 1, y: 0 },
        speed: 200,
      }),
    ];
    state.blackouts = [
      {
        id: 341,
        position: { x: 400, y: 300 },
        hitbox: { width: 100, height: 200 },
        telegraphRemainingMs: 0,
        remainingMs: 1_000,
        durationMs: 1_000,
      },
    ];

    expect(stepGame(state, EMPTY_INPUT, 100)).toEqual([]);
    expect(state.projectiles[0]?.position.x).toBe(460);
    expect(state.projectiles[0]?.blackoutRevealGraceRemainingMs).toBe(
      GAMEPLAY.blackoutRevealGraceMs,
    );
    expect(state.phase).toBe("playing");

    state.projectiles[0]!.speed = 0;
    stepGame(state, EMPTY_INPUT, GAMEPLAY.blackoutRevealGraceMs - 1);
    expect(state.phase).toBe("playing");
    const events = stepGame(state, EMPTY_INPUT, 1);
    expect(events).toContainEqual({ type: "player-hit", source: "tool-call" });
    expect(state.phase).toBe("results");
  });

  it("keeps projectiles dangerous while both player and projectile are inside rm", () => {
    const state = playingState(303, 800, 600);
    state.player.position = { x: 440, y: 300 };
    state.projectiles = [projectile(state)];
    state.projectiles[0]!.position = { ...state.player.position };
    state.blackouts = [
      {
        id: 342,
        position: { x: 400, y: 300 },
        hitbox: { width: 100, height: 200 },
        telegraphRemainingMs: 0,
        remainingMs: 1_000,
        durationMs: 1_000,
      },
    ];

    const events = stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);
    expect(events).toContainEqual({ type: "player-hit", source: "tool-call" });
    expect(state.phase).toBe("results");
  });

  it("does not let a hidden projectile hit a player beyond the rm edge", () => {
    const state = playingState(304, 800, 600);
    state.player.position = { x: 470, y: 300 };
    state.projectiles = [
      projectile(state, {
        position: { x: 440, y: 300 },
        hitbox: { width: 100, height: GAMEPLAY.toolCallHitboxHeight },
      }),
    ];
    state.blackouts = [
      {
        id: 343,
        position: { x: 400, y: 300 },
        hitbox: { width: 100, height: 200 },
        telegraphRemainingMs: 0,
        remainingMs: 1_000,
        durationMs: 1_000,
      },
    ];

    expect(stepGame(state, EMPTY_INPUT, 1)).toEqual([]);
    expect(state.projectiles[0]?.blackoutRevealGraceRemainingMs).toBe(
      GAMEPLAY.blackoutRevealGraceMs,
    );
    expect(state.phase).toBe("playing");
  });

  it("grants reveal grace on the exact frame an rm warning activates", () => {
    const state = playingState(305, 800, 600);
    state.player.position = { x: 470, y: 300 };
    state.projectiles = [
      projectile(state, {
        position: { x: 440, y: 300 },
        hitbox: { width: 100, height: GAMEPLAY.toolCallHitboxHeight },
      }),
    ];
    state.blackouts = [
      {
        id: 344,
        position: { x: 400, y: 300 },
        hitbox: { width: 100, height: 200 },
        telegraphRemainingMs: 1,
        remainingMs: 1_000,
        durationMs: 1_000,
      },
    ];

    expect(stepGame(state, EMPTY_INPUT, 1)).toEqual([]);
    expect(state.blackouts[0]?.telegraphRemainingMs).toBe(0);
    expect(state.projectiles[0]?.blackoutRevealGraceRemainingMs).toBe(
      GAMEPLAY.blackoutRevealGraceMs,
    );
    expect(state.phase).toBe("playing");
  });

  it("keeps an approval harmless while telegraphing, then makes it lethal", () => {
    const state = playingState();
    state.approvalGates = [approvalGate(state)];

    expect(stepGame(state, EMPTY_INPUT, FIXED_STEP_MS)).toEqual([]);
    expect(state.phase).toBe("playing");
    stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);
    expect(state.phase).toBe("results");
    expect(state.lastHitSource).toBe("approval");
  });

  it("keeps the deny gap in an active approval gate safe", () => {
    const state = playingState();
    state.approvalGates = [
      approvalGate(state, {
        gaps: [
          {
            center: state.player.position.y,
            size: 90,
            label: "DENY",
          },
        ],
        telegraphRemainingMs: 0,
      }),
    ];

    expect(stepGame(state, EMPTY_INPUT, FIXED_STEP_MS)).toEqual([]);
    expect(state.phase).toBe("playing");
  });

  it("collides with a horizontal approval segment in screen coordinates", () => {
    const state = playingState();
    state.player.position = { x: 150, y: 300 };
    state.approvalGates = [
      approvalGate(state, {
        position: { x: 640, y: 300 },
        direction: { x: 0, y: 1 },
        gaps: [{ center: 640, size: 90, label: "DENY" }],
        telegraphRemainingMs: 0,
      }),
    ];

    stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);
    expect(state.phase).toBe("results");
    expect(state.lastHitSource).toBe("approval");
  });

  it("keeps a horizontal approval gap safe in screen coordinates", () => {
    const state = playingState();
    state.player.position = { x: 640, y: 300 };
    state.approvalGates = [
      approvalGate(state, {
        position: { x: 640, y: 300 },
        direction: { x: 0, y: 1 },
        gaps: [{ center: 640, size: 90, label: "ALLOW ONCE" }],
        telegraphRemainingMs: 0,
      }),
    ];

    expect(stepGame(state, EMPTY_INPUT, FIXED_STEP_MS)).toEqual([]);
    expect(state.phase).toBe("playing");
  });

  it("bursts context tokens instead of turning the full frame lethal", () => {
    const state = playingState();
    state.hazards = [hazard(state)];
    state.player.position.x += 80;
    state.player.position.y += 80;

    expect(stepGame(state, EMPTY_INPUT, FIXED_STEP_MS)).toEqual([]);
    expect(state.phase).toBe("playing");
    const events = stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);

    expect(events).toContainEqual({
      type: "hazard-activated",
      kind: "compaction",
      position: { x: 640, y: 360 },
    });
    expect(
      state.projectiles.filter(
        (candidate) => candidate.kind === "context-token",
      ),
    ).toHaveLength(12);
    expect(
      state.projectiles.every((candidate) => candidate.surface === "codex"),
    ).toBe(true);
    expect(state.phase).toBe("playing");
    expect(state.lastHitSource).toBeNull();
  });

  it("keeps download access harmless while loading and lethal at ACCESS", () => {
    const state = playingState();
    state.hazards = [
      hazard(state, {
        kind: "download-access",
        label: "DOWNLOAD ACCESS",
        accessSector: "left",
      }),
    ];

    expect(stepGame(state, EMPTY_INPUT, FIXED_STEP_MS)).toEqual([]);
    expect(state.phase).toBe("playing");

    const events = stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);
    expect(events).toContainEqual({
      type: "hazard-activated",
      kind: "download-access",
      position: { ...state.player.position },
    });
    expect(events).toContainEqual({ type: "player-hit", source: "access" });
    expect(state.phase).toBe("results");
    expect(state.lastHitSource).toBe("access");
  });

  it("spawns download access independently from compaction in late stages", () => {
    const state = playingState(41, 1280, 720);
    state.elapsedMs = GAMEPLAY.stageDurationMs * 7;
    state.spawn.compactionMs = 0;
    state.spawn.downloadAccessMs = 0;

    stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);
    stepGame(state, EMPTY_INPUT, GAMEPLAY.majorPatternSeparationMs);

    expect(state.hazards.map(({ kind }) => kind)).toEqual([
      "compaction",
      "download-access",
    ]);
  });

  it("selects all four exact half-screen download access sectors", () => {
    const seen = new Set<string>();

    for (let seed = 1; seed <= 64; seed += 1) {
      const state = playingState(seed, 1_280, 720);
      state.elapsedMs = GAMEPLAY.downloadAccessFirstSpawnMs;
      state.spawn.downloadAccessMs = 0;

      stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);

      const access = state.hazards.find(
        ({ kind }) => kind === "download-access",
      );
      expect(access).toBeDefined();
      if (!access?.accessSector) {
        continue;
      }
      seen.add(access.accessSector);
      expect(access.hitbox.width * access.hitbox.height).toBeCloseTo(
        state.arena.width * state.arena.height / 2,
      );
      if (access.accessSector === "left" || access.accessSector === "right") {
        expect(access.hitbox).toEqual({ width: 640, height: 720 });
      } else {
        expect(access.hitbox).toEqual({ width: 1_280, height: 360 });
      }
    }

    expect(seen).toEqual(new Set(["top", "bottom", "left", "right"]));
  });

  it("makes burst context tokens arc outward and then fall", () => {
    const state = playingState();
    state.hazards = [hazard(state)];
    state.player.position = { x: 5, y: 5 };

    stepGame(state, EMPTY_INPUT, FIXED_STEP_MS * 2);
    const token = state.projectiles.find(
      (candidate) => candidate.kind === "context-token",
    );
    expect(token).toBeDefined();
    if (!token) {
      return;
    }

    state.hazards = [];
    state.projectiles = [token];
    token.position = { x: 400, y: 200 };
    token.velocity = { x: 1, y: -1 };
    token.speed = 100;

    stepGame(state, EMPTY_INPUT, 500);

    expect(token.position.x).toBeGreaterThan(400);
    expect(token.position.y).toBeLessThan(200);
    expect(token.velocity.x).toBeLessThan(1);
    expect(token.velocity.y).toBeGreaterThan(0);
  });

  it("bursts seeded context words with irregular trajectories", () => {
    const first = playingState(73);
    const second = playingState(73);
    first.hazards = [hazard(first)];
    second.hazards = [hazard(second)];
    first.player.position = { x: 5, y: 5 };
    second.player.position = { x: 5, y: 5 };

    stepGame(first, EMPTY_INPUT, FIXED_STEP_MS * 2);
    stepGame(second, EMPTY_INPUT, FIXED_STEP_MS * 2);

    const tokens = first.projectiles.filter(
      (candidate) => candidate.kind === "context-token",
    );
    const secondTokens = second.projectiles.filter(
      (candidate) => candidate.kind === "context-token",
    );
    expect(tokens).toEqual(secondTokens);
    expect(tokens).toHaveLength(12);
    expect(tokens.every(({ label }) => !label.startsWith("[tok]"))).toBe(true);
    expect(new Set(tokens.map(({ label }) => label)).size).toBeGreaterThan(7);
    expect(new Set(tokens.map(({ hitbox }) => hitbox.width)).size).toBeGreaterThan(
      3,
    );

    const radii = tokens.map(({ position }) =>
      Math.hypot(position.x - 640, position.y - 360).toFixed(2),
    );
    const speeds = tokens.map(({ speed }) => speed.toFixed(2));
    const gravity = tokens.map(({ gravityScale }) =>
      (gravityScale ?? 1).toFixed(2),
    );
    const angles = tokens
      .map(({ velocity }) => {
        const angle = Math.atan2(velocity.y, velocity.x);
        return angle < 0 ? angle + Math.PI * 2 : angle;
      })
      .sort((left, right) => left - right);
    const gaps = angles.map((angle, index) => {
      const next = angles[(index + 1) % angles.length] ?? angle;
      return (next + (index === angles.length - 1 ? Math.PI * 2 : 0) - angle)
        .toFixed(2);
    });

    expect(new Set(radii).size).toBeGreaterThan(5);
    expect(new Set(speeds).size).toBeGreaterThan(8);
    expect(new Set(gravity).size).toBeGreaterThan(7);
    expect(new Set(gaps).size).toBeGreaterThan(5);
  });

  it("fits compaction and download access to a small viewport", () => {
    const state = playingState(17, 375, 640);
    state.elapsedMs = GAMEPLAY.difficultyRampMs;
    state.spawn.compactionMs = 0;
    state.spawn.downloadAccessMs = 0;

    stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);
    stepGame(state, EMPTY_INPUT, GAMEPLAY.majorPatternSeparationMs);

    expect(state.hazards).toHaveLength(2);
    expect(state.hazards.map(({ kind }) => kind)).toEqual([
      "compaction",
      "download-access",
    ]);
    for (const hazard of state.hazards) {
      if (hazard.kind === "compaction") {
        expect(hazard.hitbox.width).toBe(375 * 0.675);
        expect(hazard.hitbox.height).toBe(375 * 0.675);
      } else {
        expect(hazard.hitbox.width * hazard.hitbox.height).toBeCloseTo(
          375 * 640 / 2,
        );
      }
      expect(hazard.position.x).toBeGreaterThanOrEqual(
        hazard.hitbox.width / 2,
      );
      expect(hazard.position.x).toBeLessThanOrEqual(
        state.arena.width - hazard.hitbox.width / 2,
      );
    }
  });

  it("matches projectile collision to its rotated text silhouette", () => {
    const state = playingState(1, 800, 600);
    state.player.position = { x: 450, y: 300 };
    state.projectiles = [
      projectile(state, {
        position: { x: 400, y: 300 },
        velocity: { x: 0, y: 1 },
        hitbox: { width: 120, height: 20 },
      }),
    ];

    stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);
    expect(state.phase).toBe("playing");

    state.player.position = { x: 400, y: 340 };
    stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);
    expect(state.phase).toBe("results");
  });

  it("stages every Codex pattern without same-tick major onsets", () => {
    const state = playingState(77, 900, 600);
    state.elapsedMs = GAMEPLAY.difficultyRampMs;
    state.spawn = {
      toolCallMs: 0,
      approvalMs: 0,
      compactionMs: 0,
      downloadAccessMs: 0,
      retryLoopMs: 0,
      reasoningMs: 0,
      parallelAgentsMs: 0,
      reviewLoopMs: 0,
      usageLimitMs: 0,
      blackoutMs: 0,
      majorPatternCooldownMs: 0,
      majorPatternCursor: 0,
    };

    const seen = new Set<string>();
    let sawToolStream = false;
    for (let onset = 0; onset < 9; onset += 1) {
      const events = stepGame(
        state,
        EMPTY_INPUT,
        onset === 0 ? FIXED_STEP_MS : GAMEPLAY.majorPatternSeparationMs,
      );
      sawToolStream ||= state.projectiles.some(
        (candidate) => candidate.kind === "tool-call",
      );

      const families = new Set<string>();
      for (const event of events) {
        if (event.type === "pattern-warning") {
          families.add(event.kind);
          seen.add(event.kind);
        } else if (event.type === "hazard-warning") {
          if (event.kind === "compaction") {
            families.add("context-compaction");
            seen.add("context-compaction");
          } else {
            families.add("download-access");
            seen.add("download-access");
          }
        } else if (event.type === "blackout-started") {
          families.add("wildcard-blackout");
          seen.add("wildcard-blackout");
        }
      }
      expect(families.size).toBeLessThanOrEqual(1);

      state.projectiles = [];
      state.hazards = [];
      state.sequences = [];
      state.approvalGates = [];
      state.retryChains = [];
      state.reasoningWaves = [];
      state.blackouts = [];
    }

    expect(sawToolStream).toBe(true);
    expect(seen).toEqual(
      new Set([
        "approval-required",
        "context-compaction",
        "download-access",
        "retry-loop",
        "reasoning-xhigh",
        "parallel-agents",
        "review-loop",
        "usage-limit",
        "wildcard-blackout",
      ]),
    );
  });

  it("keeps every approval gap inside the telegraph movement budget", () => {
    const reachBudget =
      GAMEPLAY.playerSpeed *
      (GAMEPLAY.approvalGateTelegraphMs / 1_000) *
      GAMEPLAY.approvalGateReachBudgetRatio;

    for (let seed = 1; seed <= 256; seed += 1) {
      const state = playingState(seed, 800, 600);
      state.elapsedMs = GAMEPLAY.approvalFirstSpawnMs;
      state.player.position = seed % 2 === 0
        ? { x: 5, y: 5 }
        : { x: 795, y: 595 };
      state.spawn.approvalMs = 0;

      stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);

      const gate = state.approvalGates[0];
      expect(gate).toBeDefined();
      if (!gate) {
        continue;
      }
      const playerAlong = Math.abs(gate.direction.x) > 0
        ? state.player.position.y
        : state.player.position.x;
      expect(
        Math.min(
          ...gate.gaps.map(({ center }) => Math.abs(center - playerAlong)),
        ),
      ).toBeLessThanOrEqual(reachBudget);
    }
  });

  it("lets another major family start while an approval wall is active", () => {
    const state = playingState(301, 1_280, 720);
    state.elapsedMs = GAMEPLAY.difficultyRampMs;
    state.approvalGates = [
      approvalGate(state, { telegraphRemainingMs: 1_000_000 }),
    ];
    state.spawn.compactionMs = 0;

    stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);
    expect(state.hazards.some(({ kind }) => kind === "compaction")).toBe(true);
  });

  it("stages independent due patterns until the three-family cap is full", () => {
    const state = playingState(302, 2_560, 1_440);
    state.elapsedMs = GAMEPLAY.difficultyRampMs;
    state.hazards = [
      hazard(state, {
        position: { x: 200, y: 200 },
        remainingMs: 1_000_000,
      }),
    ];
    state.spawn.approvalMs = 0;
    state.spawn.retryLoopMs = 0;

    stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);
    expect(state.approvalGates).toHaveLength(1);
    expect(state.retryChains).toEqual([]);

    stepGame(state, EMPTY_INPUT, GAMEPLAY.majorPatternSeparationMs);
    expect(state.approvalGates).toHaveLength(1);
    expect(state.retryChains).toHaveLength(1);
  });

  it("slows spawn cadence on a small viewport without changing attack speed", () => {
    const desktop = playingState(401, 2_560, 1_440);
    const portrait = playingState(401, 375, 640);
    desktop.spawn.toolCallMs = 0;
    portrait.spawn.toolCallMs = 0;

    stepGame(desktop, EMPTY_INPUT, FIXED_STEP_MS);
    stepGame(portrait, EMPTY_INPUT, FIXED_STEP_MS);

    expect(portrait.spawn.toolCallMs).toBeCloseTo(
      (desktop.spawn.toolCallMs + FIXED_STEP_MS) *
        GAMEPLAY.smallViewportIntervalMultiplier -
        FIXED_STEP_MS,
      0,
    );
    expect(portrait.projectiles[0]?.speed).toBe(desktop.projectiles[0]?.speed);
  });

  it("retries as one chain that reacquires the player after each failure", () => {
    const state = playingState(15, 800, 600);
    state.elapsedMs = GAMEPLAY.retryLoopFirstSpawnMs;
    state.player.position = { x: 310, y: 260 };
    state.spawn.retryLoopMs = 0;

    stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);

    const retry = state.retryChains[0];
    expect(retry).toBeDefined();
    if (!retry) {
      throw new Error("expected one retry chain");
    }
    expect(retry.attempt).toBe(1);
    expect(retry.totalAttempts).toBe(3);
    expect(retry.target).toEqual({ x: 310, y: 260 });

    state.retryChains = [
      retryChain({
        position: { x: 100, y: 100 },
        target: { x: 200, y: 100 },
        velocity: { x: 1, y: 0 },
        speed: 100,
      }),
    ];
    state.player.position = { x: 420, y: 330 };
    stepGame(state, EMPTY_INPUT, 1_000);

    const reacquired = state.retryChains[0];
    expect(reacquired?.attempt).toBe(2);
    expect(reacquired?.position).toEqual({ x: 200, y: 100 });
    expect(reacquired?.target).toEqual({ x: 420, y: 330 });
    expect(reacquired?.telegraphRemainingMs).toBe(
      GAMEPLAY.retryChainTelegraphMs,
    );
    expect(reacquired?.speed).toBe(100 * GAMEPLAY.retryChainSpeedGain);
  });

  it("holds a completed retry briefly, makes it harmless, and completes once", () => {
    const state = playingState(16, 800, 600);
    state.player.position = { x: 200, y: 100 };
    state.retryChains = [
      retryChain({
        position: { x: 100, y: 100 },
        target: { x: 200, y: 100 },
        velocity: { x: 1, y: 0 },
        speed: 100,
        attempt: 3,
        totalAttempts: 3,
      }),
    ];

    const completionEvents = stepGame(state, EMPTY_INPUT, 1_000);

    expect(completionEvents).toContainEqual({
      type: "pattern-complete",
      kind: "retry-loop",
      position: { x: 200, y: 100 },
    });
    expect(state.retryChains).toHaveLength(1);
    expect(state.retryChains[0]?.completionRemainingMs).toBe(
      GAMEPLAY.retryChainCompleteMs,
    );
    expect(state.attacksDodged).toBe(1);
    expect(state.phase).toBe("playing");

    expect(
      stepGame(state, EMPTY_INPUT, GAMEPLAY.retryChainCompleteMs / 2),
    ).toEqual([]);
    expect(state.retryChains).toHaveLength(1);
    expect(
      stepGame(state, EMPTY_INPUT, GAMEPLAY.retryChainCompleteMs / 2),
    ).toEqual([]);
    expect(state.retryChains).toEqual([]);
    expect(state.attacksDodged).toBe(1);
    expect(state.phase).toBe("playing");
  });

  it("stacks seeded rm blackouts from stage nine to four late in stage ten", () => {
    const stageNine = playingState(91, 1_000, 700);
    stageNine.elapsedMs = GAMEPLAY.stageDurationMs * 8;
    stageNine.spawn.blackoutMs = 0;

    const stageNineEvents = stepGame(stageNine, EMPTY_INPUT, FIXED_STEP_MS);
    expect(stageNine.blackouts).toHaveLength(1);
    expect(stageNineEvents).toContainEqual({
      type: "blackout-started",
      position: stageNine.blackouts[0]?.position,
    });
    expect(stageNine.blackouts[0]?.durationMs).toBe(
      GAMEPLAY.blackoutStageNineDurationMs,
    );
    expect(stageNine.blackouts[0]?.telegraphRemainingMs).toBe(
      GAMEPLAY.blackoutTelegraphMs,
    );
    stepGame(stageNine, EMPTY_INPUT, GAMEPLAY.blackoutTelegraphMs / 2);
    expect(stageNine.blackouts[0]?.remainingMs).toBe(
      GAMEPLAY.blackoutStageNineDurationMs,
    );
    stepGame(stageNine, EMPTY_INPUT, GAMEPLAY.blackoutTelegraphMs / 2);
    expect(stageNine.blackouts[0]?.telegraphRemainingMs).toBe(0);
    stepGame(stageNine, EMPTY_INPUT, 1);
    expect(stageNine.blackouts[0]?.remainingMs).toBe(
      GAMEPLAY.blackoutStageNineDurationMs - 1,
    );

    const late = playingState(92, 2_560, 1_440);
    late.elapsedMs = GAMEPLAY.difficultyRampMs + 60_000;
    late.spawn.blackoutMs = 0;
    stepGame(late, EMPTY_INPUT, FIXED_STEP_MS);
    for (let index = 0; index < 3; index += 1) {
      stepGame(late, EMPTY_INPUT, GAMEPLAY.blackoutMinimumIntervalMs);
    }

    expect(late.blackouts).toHaveLength(4);
    expect(late.blackouts.every(({ durationMs }) =>
      durationMs === GAMEPLAY.blackoutStageTenDurationMs
    )).toBe(true);
  });

  it("ends a four-minute survival with a timed task-crash sequence", () => {
    const state = playingState(180, 1_000, 700);
    state.elapsedMs = GAMEPLAY.endingAtMs - 10;
    state.projectiles = [projectile(state, { position: { x: 20, y: 20 } })];
    state.hazards = [hazard(state, { position: { x: 20, y: 20 } })];
    state.reasoningWaves = [reasoningWave(state)];

    const startEvents = stepGame(state, EMPTY_INPUT, 20);
    expect(startEvents).toEqual([{ type: "ending-started" }]);
    expect(state.phase).toBe("playing");
    expect(state.elapsedMs).toBe(GAMEPLAY.endingAtMs);
    expect(state.ending).toEqual({
      elapsedMs: 0,
      durationMs: GAMEPLAY.endingDurationMs,
    });
    expect(state.projectiles).toEqual([]);
    expect(state.hazards).toEqual([]);
    expect(state.reasoningWaves).toEqual([]);

    const endEvents = stepGame(
      state,
      EMPTY_INPUT,
      GAMEPLAY.endingDurationMs,
    );
    expect(state.phase).toBe("results");
    expect(state.ending).toBeNull();
    expect(endEvents).toEqual([
      {
        type: "run-ended",
        finalScore: GAMEPLAY.endingAtMs,
        source: null,
      },
    ]);
  });

  it("makes parallel agents cross the same snapshot from opposite sides", () => {
    const state = playingState(16, 800, 600);
    state.elapsedMs = GAMEPLAY.parallelAgentsFirstSpawnMs;
    state.player.position = { x: 360, y: 280 };
    state.spawn.parallelAgentsMs = 0;

    stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);

    const agents = state.projectiles.filter(
      (candidate) => candidate.kind === "agent",
    );
    expect(agents.map((candidate) => candidate.label)).toEqual([
      "[agent 1] working",
      "[agent 2] working",
    ]);
    expect(
      agents[0]!.velocity.x * agents[1]!.velocity.x +
        agents[0]!.velocity.y * agents[1]!.velocity.y,
    ).toBeCloseTo(-1);
    expect(agents[0]!.telegraphRemainingMs).toBe(
      agents[1]!.telegraphRemainingMs,
    );
  });

  it.each([
    ["review-loop", "finding", "ONE MORE ISSUE", 8],
    ["usage-limit", "limit", "5H LIMIT REACHED", 12],
  ] as const)(
    "turns %s convergence into a radial %s burst",
    (sequenceKind, projectileKind, label, count) => {
      const state = playingState(21, 800, 600);
      state.sequences = [
        sequence({
          kind: sequenceKind,
          label:
            sequenceKind === "review-loop"
              ? "[review] fixing findings"
              : "[usage] limit draining",
          projectileCount: count,
          resultLabel: label,
        }),
      ];

      const events = stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);

      expect(state.sequences).toEqual([]);
      expect(
        state.projectiles.filter(
          (candidate) => candidate.kind === projectileKind,
        ),
      ).toHaveLength(count);
      expect(state.projectiles.every((candidate) => candidate.label === label)).toBe(
        true,
      );
      expect(events).toContainEqual({
        type: "pattern-burst",
        kind: sequenceKind,
        position: { x: 160, y: 140 },
      });
    },
  );

  it.each([
    ["review-loop", "finding", "ONE MORE ISSUE"],
    ["usage-limit", "limit", "5H LIMIT REACHED"],
  ] as const)(
    "keeps the %s radial burst outside its snapshotted center",
    (sequenceKind, projectileKind, label) => {
      const state = playingState(31, 800, 600);
      state.player.position = { x: 240, y: 180 };
      state.sequences = [
        sequence({
          kind: sequenceKind,
          label,
          position: { ...state.player.position },
          projectileCount: 12,
          resultLabel: label,
        }),
      ];

      const events = stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);

      expect(state.phase).toBe("playing");
      expect(events).not.toContainEqual({
        type: "player-hit",
        source: projectileKind,
      });
      const burst = state.projectiles.filter(
        (candidate) => candidate.kind === projectileKind,
      );
      expect(burst).toHaveLength(12);
      expect(
        Math.min(
          ...burst.map((candidate) =>
            Math.hypot(
              candidate.position.x - state.player.position.x,
              candidate.position.y - state.player.position.y,
            ),
          ),
        ),
      ).toBeGreaterThan(GAMEPLAY.playerRadius);
    },
  );

  it("varies usage-limit outcomes across seeded runs without changing the pattern", () => {
    const resultLabels = new Set<string>();

    for (let seed = 1; seed <= 512; seed += 1) {
      const state = playingState(seed, 800, 600);
      state.elapsedMs = GAMEPLAY.usageLimitFirstSpawnMs;
      state.spawn.usageLimitMs = 0;

      stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);

      const usageSequence = state.sequences.find(
        (candidate) => candidate.kind === "usage-limit",
      );
      expect(usageSequence).toBeDefined();
      if (usageSequence) {
        resultLabels.add(usageSequence.resultLabel);
      }
    }

    expect(resultLabels).toEqual(
      new Set([
        "5H LIMIT REACHED",
        "WEEKLY LIMIT REACHED",
        "RESETS IN 4 DAYS",
      ]),
    );
  });

  it("freezes the simulation after results and restarts cleanly", () => {
    const state = playingState(1, 800, 500);
    state.projectiles = [projectile(state)];
    stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);
    const resultSnapshot = structuredClone(state);

    expect(
      stepGame(state, { direction: { x: -1, y: -1 } }, 5_000),
    ).toEqual([]);
    expect(state).toEqual(resultSnapshot);

    const restarted = restartRun(73, 800, 500);
    expect(restarted.phase).toBe("playing");
    expect(restarted.seed).toBe(73);
    expect(restarted.score).toBe(0);
    expect(restarted.arena).toEqual({ width: 800, height: 500 });
    expect(restarted.player.position).toEqual({ x: 400, y: 250 });
    expect(restarted.projectiles).toEqual([]);
    expect(restarted.hazards).toEqual([]);
    expect(restarted.sequences).toEqual([]);
    expect(restarted.reasoningWaves).toEqual([]);
  });

  it("keeps values and entity caps valid across seeded responsive runs", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const width = seed % 2 === 0 ? 375 : 1_024;
      const height = seed % 2 === 0 ? 640 : 768;
      const state = restartRun(seed, width, height);

      for (let tick = 0; tick < 5_400 && state.phase === "playing"; tick += 1) {
        stepGame(
          state,
          {
            direction: {
              x: Math.cos((tick + seed) / 75),
              y: Math.sin((tick + seed) / 75),
            },
          },
          FIXED_STEP_MS,
        );

        expect(Number.isFinite(state.player.position.x)).toBe(true);
        expect(Number.isFinite(state.player.position.y)).toBe(true);
        expect(Number.isFinite(state.elapsedMs)).toBe(true);
        expect(state.projectiles.length).toBeLessThanOrEqual(
          GAMEPLAY.maxProjectiles,
        );
        expect(state.hazards.length).toBeLessThanOrEqual(GAMEPLAY.maxHazards);
        expect(state.sequences.length).toBeLessThanOrEqual(
          GAMEPLAY.maxSequences,
        );
        expect(state.reasoningWaves.length).toBeLessThanOrEqual(
          GAMEPLAY.maxReasoningWaves,
        );
      }
    }
  });

  it("sustains one minute of stage-ten maximum spawn pressure within every cap", () => {
    for (let seed = 1; seed <= 8; seed += 1) {
      const state = playingState(
        seed,
        seed % 2 === 0 ? 375 : 1_280,
        seed % 2 === 0 ? 640 : 720,
      );
      state.elapsedMs = GAMEPLAY.difficultyRampMs;
      state.spawn = {
        toolCallMs: 0,
        approvalMs: 0,
        compactionMs: 0,
        downloadAccessMs: 0,
        retryLoopMs: 0,
        reasoningMs: 0,
        parallelAgentsMs: 0,
        reviewLoopMs: 0,
        usageLimitMs: 0,
        blackoutMs: 0,
        majorPatternCooldownMs: 0,
        majorPatternCursor: 0,
      };

      for (let tick = 0; tick < 3_600; tick += 1) {
        for (const projectile of state.projectiles) {
          projectile.telegraphRemainingMs = 1_000_000;
        }
        for (const hazardState of state.hazards) {
          hazardState.phase = "telegraph";
          hazardState.remainingMs = 1_000_000;
        }
        for (const sequenceState of state.sequences) {
          sequenceState.remainingMs = 1_000_000;
        }
        for (const gateState of state.approvalGates) {
          gateState.telegraphRemainingMs = 1_000_000;
        }
        for (const retryState of state.retryChains) {
          retryState.telegraphRemainingMs = 1_000_000;
        }
        for (const waveState of state.reasoningWaves) {
          waveState.phase = "thinking";
          waveState.telegraphRemainingMs = 1_000_000;
          waveState.radius = waveState.maxRadius;
          waveState.previousRadius = waveState.maxRadius;
        }

        stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);

        expect(state.phase).toBe("playing");
        expect(state.projectiles.length).toBeLessThanOrEqual(
          GAMEPLAY.maxProjectiles,
        );
        expect(state.hazards.length).toBeLessThanOrEqual(GAMEPLAY.maxHazards);
        expect(state.sequences.length).toBeLessThanOrEqual(
          GAMEPLAY.maxSequences,
        );
        expect(state.approvalGates.length).toBeLessThanOrEqual(
          GAMEPLAY.maxApprovalGates,
        );
        expect(state.retryChains.length).toBeLessThanOrEqual(
          GAMEPLAY.maxRetryChains,
        );
        expect(state.reasoningWaves.length).toBeLessThanOrEqual(
          GAMEPLAY.maxReasoningWaves,
        );
        expect(state.blackouts.length).toBeLessThanOrEqual(
          GAMEPLAY.maxBlackouts,
        );
      }

      expect(state.elapsedMs).toBeGreaterThan(
        GAMEPLAY.difficultyRampMs + 59_000,
      );
      expect(Number.isFinite(state.rngState)).toBe(true);
      expect(Number.isFinite(state.nextEntityId)).toBe(true);
      expect(Object.values(state.spawn).every(Number.isFinite)).toBe(true);
    }
  });
});
