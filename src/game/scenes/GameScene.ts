import Phaser from "phaser";

import { FIXED_STEP_MS } from "../constants";
import type { GameEvent, GameState } from "../core/model";
import {
  createGameState,
  resizeArena,
  restartRun,
  startRun,
  stepGame,
} from "../core/simulation";
import { InputController } from "../input/InputController";
import { GameRenderer } from "../presentation/GameRenderer";
import { Hud } from "../presentation/Hud";
import { PauseOverlay } from "../presentation/PauseOverlay";
import { FixedStepRunner } from "../runtime/FixedStepRunner";
import { readLocalBest, saveLocalBest } from "../services/localBest";
import { SoundService } from "../services/SoundService";

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private inputController!: InputController;
  private gameRenderer!: GameRenderer;
  private hud!: Hud;
  private pauseOverlay!: PauseOverlay;
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
    this.state = createGameState(
      this.createSeed(),
      this.scale.width,
      this.scale.height,
    );
    this.gameRenderer = new GameRenderer(this);
    this.hud = new Hud(this);
    this.pauseOverlay = new PauseOverlay(this.game.canvas.parentElement ?? document.body);
    this.inputController = new InputController(this);
    this.localBest = readLocalBest();

    this.game.events.on(Phaser.Core.Events.BLUR, this.handleSuspend);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.handleSuspend);
    this.game.events.on(Phaser.Core.Events.FOCUS, this.handleFocus);
    this.game.events.on(Phaser.Core.Events.VISIBLE, this.handleFocus);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize);
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
        this.applyDevelopmentElapsedTime();
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
        this.state = restartRun(
          this.createSeed(),
          this.state.arena.width,
          this.state.arena.height,
        );
        this.applyDevelopmentElapsedTime();
        this.fixedStep.reset();
        this.inputController.clearTransient();
        this.gameRenderer.resetEffects();
        this.cameras.main.resetFX();
      }
      this.renderFrame(delta);
      return;
    }

    this.inputController.consumeAction();
    this.fixedStep.advance(delta, () => {
      const events = stepGame(
        this.state,
        {
          direction: this.inputController.direction(),
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
      this.soundService.isMuted,
    );
    this.pauseOverlay.render(this.focusPaused, this.state.elapsedMs);
  }

  private handleEvents(events: readonly GameEvent[]): void {
    if (events.length === 0) {
      return;
    }

    this.gameRenderer.consume(events, this.state);
    this.soundService.consume(events);

    for (const event of events) {
      if (event.type === "hazard-activated") {
        this.cameras.main.shake(70, 0.0015, true);
      } else if (event.type === "pattern-burst") {
        this.cameras.main.shake(
          event.kind === "merge-bug" ? 130 : 90,
          event.kind === "merge-bug" ? 0.004 : 0.0025,
          true,
        );
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

  private readonly handleResize = (gameSize: Phaser.Structs.Size): void => {
    resizeArena(this.state, gameSize.width, gameSize.height);
    this.cameras.main.setViewport(0, 0, gameSize.width, gameSize.height);
  };

  private readonly handleShutdown = (): void => {
    this.game.events.off(Phaser.Core.Events.BLUR, this.handleSuspend);
    this.game.events.off(Phaser.Core.Events.HIDDEN, this.handleSuspend);
    this.game.events.off(Phaser.Core.Events.FOCUS, this.handleFocus);
    this.game.events.off(Phaser.Core.Events.VISIBLE, this.handleFocus);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize);
    this.inputController.destroy();
    this.pauseOverlay.destroy();
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

  private applyDevelopmentElapsedTime(): void {
    if (!import.meta.env.DEV) {
      return;
    }

    const requestedSeconds = Number(
      new URLSearchParams(window.location.search).get("qaElapsedSeconds"),
    );

    if (!Number.isFinite(requestedSeconds) || requestedSeconds <= 0) {
      return;
    }

    this.state.elapsedMs = Math.floor(requestedSeconds * 1_000);
    this.state.score = this.state.elapsedMs;
    this.state.spawn.logMs = Math.min(this.state.spawn.logMs, 250);
    this.state.spawn.reviewMs = Math.min(this.state.spawn.reviewMs, 350);
    this.state.spawn.contextMaxMs = Math.min(this.state.spawn.contextMaxMs, 450);
    this.state.spawn.retryLoopMs = Math.min(this.state.spawn.retryLoopMs, 520);
    this.state.spawn.forkBombMs = Math.min(this.state.spawn.forkBombMs, 620);
    this.state.spawn.raceConditionMs = Math.min(
      this.state.spawn.raceConditionMs,
      720,
    );
    this.state.spawn.mergeBugMs = Math.min(this.state.spawn.mergeBugMs, 820);
  }
}
