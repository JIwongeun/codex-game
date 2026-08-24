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
import { ReadyOverlay } from "../presentation/ReadyOverlay";
import { FixedStepRunner } from "../runtime/FixedStepRunner";
import { FocusPauseController } from "../runtime/FocusPauseController";
import { logicalViewportFor } from "../runtime/logicalViewport";
import {
  renderQualityFor,
  textTextureResolution,
} from "../runtime/renderQuality";
import {
  readGuestSessionBest,
  saveGuestSessionBest,
} from "../services/localBest";
import { SoundService } from "../services/SoundService";

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private inputController!: InputController;
  private gameRenderer!: GameRenderer;
  private hud!: Hud;
  private pauseOverlay!: PauseOverlay;
  private readyOverlay!: ReadyOverlay;
  private readonly fixedStep = new FixedStepRunner();
  private readonly soundService = new SoundService();
  private focusPause!: FocusPauseController;
  private localBest = 0;

  constructor() {
    super("game");
  }

  create(): void {
    this.fixedStep.reset();
    const logicalViewport = logicalViewportFor(
      this.scale.width,
      this.scale.height,
    );
    this.state = createGameState(
      this.createSeed(),
      logicalViewport.width,
      logicalViewport.height,
    );
    const textResolution = textTextureResolution(window.devicePixelRatio);
    this.gameRenderer = new GameRenderer(this, textResolution);
    this.hud = new Hud(this, textResolution);
    const gameParent = this.game.canvas.parentElement ?? document.body;
    this.pauseOverlay = new PauseOverlay(gameParent);
    this.readyOverlay = new ReadyOverlay(
      gameParent,
      this.soundService.volume,
      (volume) => {
        this.soundService.setVolume(volume);
        if (volume > 0 && this.soundService.isMuted) {
          this.soundService.toggleMute();
        }
        this.soundService.unlock();
      },
    );
    this.inputController = new InputController(this);
    this.focusPause = new FocusPauseController(
      this.fixedStep,
      this.inputController,
    );
    this.localBest = readGuestSessionBest();

    this.game.events.on(Phaser.Core.Events.BLUR, this.handleSuspend);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.handleSuspend);
    this.game.events.on(Phaser.Core.Events.FOCUS, this.handleFocus);
    this.game.events.on(Phaser.Core.Events.VISIBLE, this.handleFocus);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown);
    this.applyViewport(this.scale.width, this.scale.height);

    this.renderFrame(0);
  }

  update(_time: number, delta: number): void {
    if (this.inputController.consumeMuteToggle()) {
      const muted = this.soundService.toggleMute();
      if (!muted) {
        this.soundService.unlock();
      }
    }

    if (
      this.inputController.consumeExit() &&
      this.state.phase === "playing"
    ) {
      this.returnToReady();
      this.renderFrame(0);
      return;
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

    if (this.focusPause.isPaused) {
      if (this.inputController.consumeAction()) {
        this.soundService.unlock();
        this.focusPause.resume();
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
        this.handleEvents([{ type: "run-started" }]);
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
    this.soundService.syncMusic(
      this.state.phase === "playing" && !this.focusPause.isPaused,
      this.state.elapsedMs,
    );
    this.gameRenderer.render(this.state, this.focusPause.isPaused ? 0 : delta);
    this.hud.render(
      this.state,
      this.localBest,
      this.soundService.isMuted,
    );
    this.readyOverlay.render(this.state, this.localBest);
    this.pauseOverlay.render(this.focusPause.isPaused, this.state.elapsedMs);
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
          event.kind === "usage-limit" ? 130 : 90,
          event.kind === "usage-limit" ? 0.004 : 0.0025,
          true,
        );
      } else if (event.type === "player-hit") {
        this.cameras.main.shake(180, 0.008, true);
      } else if (event.type === "run-ended") {
        this.localBest = saveGuestSessionBest(event.finalScore, this.localBest);
        this.fixedStep.reset();
      }
    }
  }

  private readonly handleSuspend = (): void => {
    this.soundService.pauseMusic();
    this.focusPause.suspend(this.state.phase);
  };

  private readonly handleFocus = (): void => {
    this.focusPause.focus();
  };

  private readonly handleResize = (gameSize: Phaser.Structs.Size): void => {
    this.applyViewport(gameSize.width, gameSize.height);
  };

  private applyViewport(viewportWidth: number, viewportHeight: number): void {
    const logicalViewport = logicalViewportFor(viewportWidth, viewportHeight);
    const renderQuality = renderQualityFor(
      viewportWidth,
      viewportHeight,
      window.devicePixelRatio,
      window.screen?.width ?? viewportWidth,
      window.screen?.height ?? viewportHeight,
    );
    const canvas = this.game.canvas;

    if (
      canvas.width !== renderQuality.backingWidth ||
      canvas.height !== renderQuality.backingHeight
    ) {
      canvas.width = renderQuality.backingWidth;
      canvas.height = renderQuality.backingHeight;
      this.game.renderer.resize(
        renderQuality.backingWidth,
        renderQuality.backingHeight,
      );
    }

    resizeArena(this.state, logicalViewport.width, logicalViewport.height);
    this.cameras.main
      .setViewport(
        0,
        0,
        renderQuality.backingWidth,
        renderQuality.backingHeight,
      )
      .setZoom(logicalViewport.zoom * renderQuality.renderScale)
      .setBounds(0, 0, logicalViewport.width, logicalViewport.height)
      .centerOn(logicalViewport.width / 2, logicalViewport.height / 2);
  }

  private readonly handleShutdown = (): void => {
    this.game.events.off(Phaser.Core.Events.BLUR, this.handleSuspend);
    this.game.events.off(Phaser.Core.Events.HIDDEN, this.handleSuspend);
    this.game.events.off(Phaser.Core.Events.FOCUS, this.handleFocus);
    this.game.events.off(Phaser.Core.Events.VISIBLE, this.handleFocus);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize);
    this.inputController.destroy();
    this.pauseOverlay.destroy();
    this.readyOverlay.destroy();
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

  private returnToReady(): void {
    const { width, height } = this.state.arena;
    if (this.focusPause.isPaused) {
      this.focusPause.resume();
    }
    this.state = createGameState(this.createSeed(), width, height);
    this.fixedStep.reset();
    this.inputController.clearTransient();
    this.gameRenderer.resetEffects();
    this.cameras.main.resetFX();
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
    this.state.spawn.toolCallMs = Math.min(this.state.spawn.toolCallMs, 250);
    this.state.spawn.approvalMs = Math.min(this.state.spawn.approvalMs, 350);
    this.state.spawn.compactionMs = Math.min(this.state.spawn.compactionMs, 450);
    this.state.spawn.retryLoopMs = Math.min(this.state.spawn.retryLoopMs, 520);
    this.state.spawn.downloadAccessMs = Math.min(
      this.state.spawn.downloadAccessMs,
      590,
    );
    this.state.spawn.reasoningMs = Math.min(this.state.spawn.reasoningMs, 660);
    this.state.spawn.parallelAgentsMs = Math.min(
      this.state.spawn.parallelAgentsMs,
      720,
    );
    this.state.spawn.reviewLoopMs = Math.min(this.state.spawn.reviewLoopMs, 820);
    this.state.spawn.usageLimitMs = Math.min(this.state.spawn.usageLimitMs, 920);
  }
}
