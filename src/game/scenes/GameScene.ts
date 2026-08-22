import Phaser from "phaser";

import { FIXED_STEP_MS, RUN_DURATION_MS } from "../constants";
import type { GameEvent, GameState } from "../core/model";
import {
  createGameState,
  restartRun,
  startRun,
  stepGame,
} from "../core/simulation";
import { InputController } from "../input/InputController";
import { GameRenderer } from "../presentation/GameRenderer";
import { Hud } from "../presentation/Hud";
import { FixedStepRunner } from "../runtime/FixedStepRunner";
import { readLocalBest, saveLocalBest } from "../services/localBest";
import { SoundService } from "../services/SoundService";

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private inputController!: InputController;
  private gameRenderer!: GameRenderer;
  private hud!: Hud;
  private readonly fixedStep = new FixedStepRunner();
  private readonly soundService = new SoundService();
  private localBest = 0;
  private focusPaused = false;

  constructor() {
    super("game");
  }

  create(): void {
    this.focusPaused = false;
    this.fixedStep.reset();
    this.state = createGameState(this.createSeed());
    this.gameRenderer = new GameRenderer(this);
    this.hud = new Hud(this);
    this.inputController = new InputController(this);
    this.localBest = readLocalBest();

    this.game.events.on(Phaser.Core.Events.BLUR, this.handleSuspend);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.handleSuspend);
    this.game.events.on(Phaser.Core.Events.FOCUS, this.handleFocus);
    this.game.events.on(Phaser.Core.Events.VISIBLE, this.handleFocus);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown);

    this.renderFrame(0);
  }

  update(_time: number, delta: number): void {
    if (this.inputController.consumeMuteToggle()) {
      const muted = this.soundService.toggleMute();

      if (!muted) {
        this.soundService.unlock();
      }
    }

    if (this.state.phase === "ready") {
      if (this.inputController.consumeAction()) {
        this.soundService.unlock();
        const events = startRun(this.state);
        this.applyDevelopmentRunWindow();
        this.inputController.clearTransient();
        this.handleEvents(events);
      }

      this.renderFrame(delta);
      return;
    }

    if (this.focusPaused) {
      if (this.inputController.consumeAction()) {
        this.soundService.unlock();
        this.focusPaused = false;
        this.fixedStep.reset();
        this.inputController.clearTransient();
      }

      this.renderFrame(0);
      return;
    }

    if (this.state.phase === "results") {
      if (this.inputController.consumeAction()) {
        this.soundService.unlock();
        this.state = restartRun(this.createSeed());
        this.applyDevelopmentRunWindow();
        this.fixedStep.reset();
        this.inputController.clearTransient();
        this.gameRenderer.resetEffects();
        this.cameras.main.resetFX();
      }

      this.renderFrame(delta);
      return;
    }

    this.fixedStep.advance(delta, () => {
      const events = stepGame(
        this.state,
        {
          direction: this.inputController.direction(
            this.state.player.position,
            this.state.player.direction,
          ),
          compactPressed: this.inputController.consumeAction(),
        },
        FIXED_STEP_MS,
      );
      this.handleEvents(events);
      return this.state.phase === "playing";
    });

    this.renderFrame(delta);
  }

  private renderFrame(delta: number): void {
    this.gameRenderer.render(this.state, this.focusPaused ? 0 : delta);
    this.hud.render(
      this.state,
      this.localBest,
      this.focusPaused,
      this.soundService.isMuted,
    );
  }

  private handleEvents(events: readonly GameEvent[]): void {
    if (events.length === 0) {
      return;
    }

    this.gameRenderer.consume(events, this.state);
    this.soundService.consume(events);

    for (const event of events) {
      if (event.type === "compacted") {
        this.cameras.main.shake(110, 0.0035, true);
      } else if (event.type === "player-hit") {
        this.cameras.main.shake(180, 0.008, true);
      } else if (event.type === "run-ended") {
        this.localBest = saveLocalBest(event.finalScore, this.localBest);
        this.fixedStep.reset();
      }
    }
  }

  private readonly handleSuspend = (): void => {
    if (this.state.phase !== "playing") {
      return;
    }

    this.focusPaused = true;
    this.fixedStep.reset();
    this.inputController.resetForSuspend();
  };

  private readonly handleFocus = (): void => {
    this.fixedStep.reset();
    this.inputController.resetForSuspend();
  };

  private readonly handleShutdown = (): void => {
    this.game.events.off(Phaser.Core.Events.BLUR, this.handleSuspend);
    this.game.events.off(Phaser.Core.Events.HIDDEN, this.handleSuspend);
    this.game.events.off(Phaser.Core.Events.FOCUS, this.handleFocus);
    this.game.events.off(Phaser.Core.Events.VISIBLE, this.handleFocus);
    this.inputController.destroy();
    this.soundService.destroy();
  };

  private createSeed(): number {
    try {
      const values = new Uint32Array(1);
      crypto.getRandomValues(values);
      return values[0] ?? 1;
    } catch {
      return (Date.now() ^ Math.floor(performance.now() * 1_000)) >>> 0;
    }
  }

  private applyDevelopmentRunWindow(): void {
    if (!import.meta.env.DEV) {
      return;
    }

    const requestedSeconds = Number(
      new URLSearchParams(window.location.search).get("qaRunSeconds"),
    );

    if (
      !Number.isFinite(requestedSeconds) ||
      requestedSeconds < 1 ||
      requestedSeconds >= RUN_DURATION_MS / 1_000
    ) {
      return;
    }

    const remainingMs = Math.floor(requestedSeconds * 1_000);
    this.state.elapsedMs = RUN_DURATION_MS - remainingMs;
    this.state.remainingMs = remainingMs;
  }
}
