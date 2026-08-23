import { describe, expect, it } from "vitest";

import { FIXED_STEP_MS, GAMEPLAY } from "../constants";
import type {
  AreaHazardState,
  AttackSequenceState,
  GameState,
  ProjectileState,
} from "./model";
import {
  createGameState,
  EMPTY_INPUT,
  resizeArena,
  restartRun,
  startRun,
  stepGame,
} from "./simulation";

function playingState(seed = 1, width = 1280, height = 720): GameState {
  const state = createGameState(seed, width, height);
  startRun(state);
  state.spawn = {
    toolCallMs: 1_000_000,
    approvalMs: 1_000_000,
    compactionMs: 1_000_000,
    retryLoopMs: 1_000_000,
    reasoningMs: 1_000_000,
    parallelAgentsMs: 1_000_000,
    reviewLoopMs: 1_000_000,
    usageLimitMs: 1_000_000,
  };
  return state;
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
    label: "CONTEXT COMPACTED",
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

  it("locks an approval path to the spawn-time player snapshot", () => {
    const state = playingState(17, 800, 600);
    state.elapsedMs = GAMEPLAY.approvalFirstSpawnMs;
    state.player.position = { x: 190, y: 430 };
    state.spawn.approvalMs = 0;

    stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);

    const spawned = state.projectiles.find(
      (candidate) => candidate.kind === "approval",
    );
    expect(spawned).toBeDefined();
    if (!spawned) {
      throw new Error("expected an approval projectile");
    }

    const snapshotDirection = {
      x: state.player.position.x - spawned.position.x,
      y: state.player.position.y - spawned.position.y,
    };
    const crossProduct =
      snapshotDirection.x * spawned.velocity.y -
      snapshotDirection.y * spawned.velocity.x;
    expect(crossProduct).toBeCloseTo(0);

    const initialVelocity = { ...spawned.velocity };
    state.player.position = { x: 760, y: 40 };
    stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);
    expect(spawned.velocity).toEqual(initialVelocity);
    expect(spawned.hitbox.width).toBeGreaterThanOrEqual(
      GAMEPLAY.approvalHitboxMinWidth,
    );
    expect(spawned.hitbox.width).toBeLessThanOrEqual(
      GAMEPLAY.approvalHitboxMaxWidth,
    );
  });

  it("holds xhigh reasoning, then fires at one immutable snapshot", () => {
    const state = playingState(18, 800, 600);
    state.elapsedMs = GAMEPLAY.reasoningFirstSpawnMs;
    state.player.position = { x: 240, y: 410 };
    state.spawn.reasoningMs = 0;

    stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);

    const spawned = state.projectiles.find(
      (candidate) => candidate.kind === "reasoning",
    );
    expect(spawned).toBeDefined();
    if (!spawned) {
      throw new Error("expected an xhigh reasoning projectile");
    }

    expect(spawned.label).toBe("[effort] xhigh · thinking...");
    expect(spawned.telegraphRemainingMs).toBe(GAMEPLAY.reasoningTelegraphMs);
    const initialVelocity = { ...spawned.velocity };
    state.player.position = { x: 760, y: 40 };
    stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);
    expect(spawned.velocity).toEqual(initialVelocity);
  });

  it("selects seeded parody labels with bounded label-sized hitboxes", () => {
    const toolCallLabels = new Set<string>();
    const approvalLabels = new Set<string>();
    const approvalSurfaces = new Map<string, string>();

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
        } else {
          approvalLabels.add(candidate.label);
          approvalSurfaces.set(candidate.label, candidate.surface);
          expect(candidate.hitbox.width).toBeGreaterThanOrEqual(
            GAMEPLAY.approvalHitboxMinWidth,
          );
          expect(candidate.hitbox.width).toBeLessThanOrEqual(
            GAMEPLAY.approvalHitboxMaxWidth,
          );
        }
      }
    }

    expect(toolCallLabels).toEqual(
      new Set([
        "+ one more change",
        "$ pnpm test --run",
        "$ rg --files -g AGENTS.md",
        "$ git diff --stat",
        "$ git status --short",
        "[tool] reading AGENTS.md",
        "[tool] rereading same file",
        "warning: tree is dirty",
        "error: command timed out",
        "codex: checking diff again",
        "codex: fixing one last test",
        "404 Not Found",
        "ERR_CONNECTION_REFUSED",
        "PAGE_UNRESPONSIVE",
        "net::ERR_FAILED",
      ]),
    );
    expect(approvalLabels).toEqual(
      new Set([
        "[approval] allow full access?",
        "[approval] run outside sandbox?",
        "[approval] allow network?",
        "[approval] approve session?",
      ]),
    );
    expect(approvalSurfaces).toEqual(
      new Map([
        ["[approval] allow full access?", "codex"],
        ["[approval] run outside sandbox?", "codex"],
        ["[approval] allow network?", "codex"],
        ["[approval] approve session?", "codex"],
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

  it("keeps an approval harmless while telegraphing, then makes it lethal", () => {
    const state = playingState();
    state.projectiles = [
      projectile(state, {
        kind: "approval",
        surface: "codex",
        label: "[approval] allow full access?",
        hitbox: {
          width: GAMEPLAY.approvalHitboxMinWidth,
          height: GAMEPLAY.approvalHitboxHeight,
        },
        telegraphRemainingMs: FIXED_STEP_MS * 2,
      }),
    ];

    expect(stepGame(state, EMPTY_INPUT, FIXED_STEP_MS)).toEqual([]);
    expect(state.phase).toBe("playing");
    stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);
    expect(state.phase).toBe("results");
    expect(state.lastHitSource).toBe("approval");
  });

  it("makes context compaction lethal only after its warning expires", () => {
    const state = playingState();
    state.hazards = [hazard(state)];

    expect(stepGame(state, EMPTY_INPUT, FIXED_STEP_MS)).toEqual([]);
    expect(state.phase).toBe("playing");
    const events = stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);

    expect(events).toContainEqual({
      type: "hazard-activated",
      kind: "compaction",
    });
    expect(state.phase).toBe("results");
    expect(state.lastHitSource).toBe("compaction");
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

  it("spawns all eight Codex attack patterns at stage ten", () => {
    const state = playingState(77, 900, 600);
    state.elapsedMs = GAMEPLAY.difficultyRampMs;
    state.spawn = {
      toolCallMs: 0,
      approvalMs: 0,
      compactionMs: 0,
      retryLoopMs: 0,
      reasoningMs: 0,
      parallelAgentsMs: 0,
      reviewLoopMs: 0,
      usageLimitMs: 0,
    };

    const events = stepGame(
      state,
      EMPTY_INPUT,
      FIXED_STEP_MS,
    );

    expect(
      state.projectiles.some((candidate) => candidate.kind === "tool-call"),
    ).toBe(true);
    expect(
      state.projectiles.some((candidate) => candidate.kind === "approval"),
    ).toBe(true);
    expect(
      state.hazards.some((candidate) => candidate.kind === "compaction"),
    ).toBe(true);
    expect(
      state.projectiles.some((candidate) => candidate.kind === "retry"),
    ).toBe(true);
    expect(
      state.projectiles.some((candidate) => candidate.kind === "reasoning"),
    ).toBe(true);
    expect(
      state.projectiles.some((candidate) => candidate.kind === "agent"),
    ).toBe(true);
    expect(state.sequences.map((candidate) => candidate.kind).sort()).toEqual([
      "review-loop",
      "usage-limit",
    ]);
    expect(
      state.sequences.find((candidate) => candidate.kind === "usage-limit")
        ?.origins,
    ).toHaveLength(8);
    expect(events.filter((event) => event.type === "hazard-warning")).toHaveLength(
      3,
    );
    expect(events.filter((event) => event.type === "pattern-warning")).toHaveLength(5);
    expect(
      state.projectiles.every((candidate) => candidate.telegraphRemainingMs > 0),
    ).toBe(true);
  });

  it("retries one snapshot with numbered time-staggered projectiles", () => {
    const state = playingState(15, 800, 600);
    state.elapsedMs = GAMEPLAY.retryLoopFirstSpawnMs;
    state.player.position = { x: 310, y: 260 };
    state.spawn.retryLoopMs = 0;

    stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);

    const retries = state.projectiles.filter(
      (candidate) => candidate.kind === "retry",
    );
    expect(retries.map((candidate) => candidate.label)).toEqual([
      "[tool] retry 1/3",
      "[tool] retry 2/3",
      "[tool] retry 3/3",
    ]);
    expect(retries[0]!.telegraphRemainingMs).toBeLessThan(
      retries[1]!.telegraphRemainingMs,
    );
    for (const retry of retries) {
      const snapshotDirection = {
        x: 310 - retry.position.x,
        y: 260 - retry.position.y,
      };
      expect(
        snapshotDirection.x * retry.velocity.y -
          snapshotDirection.y * retry.velocity.x,
      ).toBeCloseTo(0);
    }
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
    ["usage-limit", "limit", "LIMIT REACHED", 12],
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
    ["usage-limit", "limit", "LIMIT REACHED"],
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
        retryLoopMs: 0,
        reasoningMs: 0,
        parallelAgentsMs: 0,
        reviewLoopMs: 0,
        usageLimitMs: 0,
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

        stepGame(state, EMPTY_INPUT, FIXED_STEP_MS);

        expect(state.phase).toBe("playing");
        expect(state.projectiles.length).toBeLessThanOrEqual(
          GAMEPLAY.maxProjectiles,
        );
        expect(state.hazards.length).toBeLessThanOrEqual(GAMEPLAY.maxHazards);
        expect(state.sequences.length).toBeLessThanOrEqual(
          GAMEPLAY.maxSequences,
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
