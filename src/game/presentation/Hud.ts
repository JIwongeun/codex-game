import Phaser from "phaser";

import {
  GAME_HEIGHT,
  GAME_WIDTH,
  GAMEPLAY,
  STARTING_LIVES,
} from "../constants";
import type { GameState } from "../core/model";
import { contextRatio, riskMultiplier } from "../core/rules";

const SCORE_FORMAT = new Intl.NumberFormat("en-US");
const FONT = "Cascadia Code, SFMono-Regular, Consolas, monospace";

export class Hud {
  private readonly chrome: Phaser.GameObjects.Graphics;
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly timeText: Phaser.GameObjects.Text;
  private readonly livesText: Phaser.GameObjects.Text;
  private readonly contextText: Phaser.GameObjects.Text;
  private readonly hintText: Phaser.GameObjects.Text;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly subtitleText: Phaser.GameObjects.Text;
  private readonly detailText: Phaser.GameObjects.Text;
  private readonly actionText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.chrome = scene.add.graphics().setDepth(20);
    this.overlay = scene.add.graphics().setDepth(30);
    this.scoreText = this.text(scene, 30, 17, 20, "#f2f4f8").setDepth(21);
    this.timeText = this.text(scene, GAME_WIDTH / 2, 14, 30, "#68f7c1")
      .setOrigin(0.5, 0)
      .setDepth(21);
    this.livesText = this.text(scene, GAME_WIDTH - 30, 17, 20, "#f2f4f8")
      .setOrigin(1, 0)
      .setDepth(21);
    this.contextText = this.text(
      scene,
      GAME_WIDTH / 2,
      48,
      14,
      "#8d9bad",
    )
      .setOrigin(0.5, 0)
      .setDepth(21);
    this.hintText = this.text(
      scene,
      GAME_WIDTH / 2,
      GAME_HEIGHT - 19,
      13,
      "#617286",
    )
      .setOrigin(0.5, 0.5)
      .setDepth(21);
    this.titleText = this.text(
      scene,
      GAME_WIDTH / 2,
      220,
      54,
      "#f2f4f8",
    )
      .setOrigin(0.5)
      .setDepth(31);
    this.subtitleText = this.text(
      scene,
      GAME_WIDTH / 2,
      286,
      22,
      "#68f7c1",
    )
      .setOrigin(0.5)
      .setDepth(31);
    this.detailText = this.text(
      scene,
      GAME_WIDTH / 2,
      410,
      18,
      "#a6b2c2",
    )
      .setOrigin(0.5)
      .setAlign("center")
      .setLineSpacing(10)
      .setDepth(31);
    this.actionText = this.text(
      scene,
      GAME_WIDTH / 2,
      555,
      20,
      "#f2f4f8",
    )
      .setOrigin(0.5)
      .setDepth(31);
  }

  render(
    state: GameState,
    localBest: number,
    focusPaused: boolean,
    muted: boolean,
  ): void {
    this.drawChrome(state);
    this.scoreText.setText(`SCORE  ${SCORE_FORMAT.format(state.score)}`);
    this.timeText.setText(this.formatTime(state.remainingMs));
    this.livesText.setText(
      `LIVES  ${"● ".repeat(state.lives)}${"○ ".repeat(
        Math.max(0, STARTING_LIVES - state.lives),
      )}`.trimEnd(),
    );
    this.contextText.setText(this.contextLabel(state));
    this.hintText.setText(
      `MOVE  MOUSE / WASD / ARROWS     COMPACT  CLICK / SPACE     M  ${
        muted ? "UNMUTE" : "MUTE"
      }`,
    );

    if (focusPaused) {
      this.showOverlay(
        "TASK SUSPENDED",
        "accumulator cleared · run state preserved",
        "게임과 타이머가 멈췄습니다.\n돌아온 입력은 COMPACT로 재사용되지 않습니다.",
        "[ CLICK OR SPACE TO RESUME ]",
      );
    } else if (state.phase === "ready") {
      this.showOverlay(
        "await CODEX",
        "CONTEXT//OVERFLOW",
        `Codex가 작업하는 동안 Context를 모으세요.\n\nMOVE  mouse / WASD / arrows\nCOMPACT  click / SPACE before overflow\n\nLOCAL BEST  ${SCORE_FORMAT.format(
          localBest,
        )}`,
        "[ CLICK OR SPACE TO RUN ]",
      );
    } else if (state.phase === "results") {
      const title = state.endReason === "time" ? "RUN COMPLETE" : "PROCESS KILLED";
      this.showOverlay(
        title,
        `seed ${state.seed.toString(16).padStart(8, "0")}`,
        `SCORE  ${SCORE_FORMAT.format(state.score)}\nLOCAL BEST  ${SCORE_FORMAT.format(
          localBest,
        )}\n\nCOMPACTS  ${state.compactCount}     TOKENS  ${
          state.tokensCollected
        }     CLEARED  ${state.enemiesDestroyed}`,
        "[ CLICK OR SPACE TO RETRY ]",
      );
    } else {
      this.hideOverlay();
    }
  }

  private drawChrome(state: GameState): void {
    const ratio = contextRatio(state.pendingTokens);
    const barX = 390;
    const barY = 68;
    const barWidth = 500;
    const barHeight = 6;
    const warning = state.pendingTokens >= GAMEPLAY.contextWarningAt;
    const barColor = warning ? 0xff4f87 : 0x68f7c1;

    this.chrome.clear();
    this.chrome.fillStyle(0x0a1017, 0.96);
    this.chrome.fillRect(0, 0, GAME_WIDTH, 80);
    this.chrome.lineStyle(1, 0x253444, 1);
    this.chrome.lineBetween(0, 79, GAME_WIDTH, 79);
    this.chrome.fillStyle(0x1e2a36, 1);
    this.chrome.fillRoundedRect(barX, barY, barWidth, barHeight, 3);
    if (ratio > 0) {
      this.chrome.fillStyle(
        barColor,
        warning ? 0.8 + Math.sin(state.elapsedMs / 80) * 0.2 : 1,
      );
      this.chrome.fillRoundedRect(barX, barY, barWidth * ratio, barHeight, 3);
    }
  }

  private contextLabel(state: GameState): string {
    const overflow =
      state.overflowRemainingMs === null
        ? ""
        : `  ·  OVERFLOW ${(state.overflowRemainingMs / 1_000).toFixed(1)}s`;
    return `CONTEXT ${state.pendingTokens.toString().padStart(2, "0")}/${
      GAMEPLAY.contextCapacity
    }  ·  ×${riskMultiplier(state.pendingTokens).toFixed(1)}${overflow}`;
  }

  private formatTime(remainingMs: number): string {
    const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1_000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  private showOverlay(
    title: string,
    subtitle: string,
    detail: string,
    action: string,
  ): void {
    this.overlay.setVisible(true).clear();
    this.overlay.fillStyle(0x030508, 0.78);
    this.overlay.fillRect(0, 80, GAME_WIDTH, GAME_HEIGHT - 80);
    this.overlay.fillStyle(0x0b121b, 0.96);
    this.overlay.fillRoundedRect(250, 154, 780, 450, 18);
    this.overlay.lineStyle(2, 0x30465b, 1);
    this.overlay.strokeRoundedRect(250, 154, 780, 450, 18);
    this.titleText.setText(title).setVisible(true);
    this.subtitleText.setText(subtitle).setVisible(true);
    this.detailText.setText(detail).setVisible(true);
    this.actionText.setText(action).setVisible(true);
  }

  private hideOverlay(): void {
    this.overlay.setVisible(false);
    this.titleText.setVisible(false);
    this.subtitleText.setVisible(false);
    this.detailText.setVisible(false);
    this.actionText.setVisible(false);
  }

  private text(
    scene: Phaser.Scene,
    x: number,
    y: number,
    size: number,
    color: string,
  ): Phaser.GameObjects.Text {
    return scene.add.text(x, y, "", {
      color,
      fontFamily: FONT,
      fontSize: `${size}px`,
    });
  }
}
