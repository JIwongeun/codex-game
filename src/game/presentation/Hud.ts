import Phaser from "phaser";

import type { GameState } from "../core/model";
import { difficultyAt, formatSurvivalTime } from "../core/rules";
import { overflowPresentationAt } from "./overflowPresentation";
import { FONTS, TEXT_COLORS } from "./theme";

export class Hud {
  private readonly brandText: Phaser.GameObjects.Text;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly stageText: Phaser.GameObjects.Text;
  private readonly timeText: Phaser.GameObjects.Text;
  private readonly bestText: Phaser.GameObjects.Text;
  private readonly hintText: Phaser.GameObjects.Text;
  private readonly footerText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, textResolution: number) {
    this.brandText = this.text(
      scene,
      0,
      0,
      12,
      TEXT_COLORS.ink,
      textResolution,
    )
      .setFontStyle("700")
      .setLetterSpacing(0.7)
      .setDepth(32);
    this.statusText = this.text(
      scene,
      0,
      0,
      9,
      TEXT_COLORS.muted,
      textResolution,
    )
      .setFontStyle("620")
      .setLetterSpacing(0.6)
      .setDepth(21);
    this.stageText = this.text(
      scene,
      0,
      0,
      9,
      TEXT_COLORS.muted,
      textResolution,
    )
      .setFontStyle("650")
      .setLetterSpacing(0.8)
      .setOrigin(0.5, 0)
      .setDepth(21);
    this.timeText = this.text(
      scene,
      0,
      0,
      24,
      TEXT_COLORS.ink,
      textResolution,
    )
      .setFontStyle("680")
      .setLetterSpacing(0.7)
      .setOrigin(1, 0)
      .setDepth(21);
    this.bestText = this.text(
      scene,
      0,
      0,
      9,
      TEXT_COLORS.faint,
      textResolution,
    )
      .setFontStyle("560")
      .setLetterSpacing(0.5)
      .setOrigin(1, 0)
      .setDepth(21);
    this.hintText = this.text(
      scene,
      0,
      0,
      8,
      TEXT_COLORS.muted,
      textResolution,
    )
      .setFontStyle("580")
      .setLetterSpacing(0.6)
      .setOrigin(0, 1)
      .setDepth(21);
    this.footerText = this.text(
      scene,
      0,
      0,
      9,
      TEXT_COLORS.faint,
      textResolution,
    )
      .setFontStyle("580")
      .setLetterSpacing(0.55)
      .setOrigin(1, 1)
      .setDepth(32);
  }

  render(state: GameState, localBest: number, muted: boolean): void {
    const showGameChrome = state.phase === "playing";
    this.brandText.setVisible(showGameChrome);
    this.statusText.setVisible(showGameChrome);
    this.stageText.setVisible(showGameChrome);
    this.timeText.setVisible(showGameChrome);
    this.bestText.setVisible(showGameChrome);
    this.hintText.setVisible(showGameChrome);
    this.footerText.setVisible(showGameChrome);

    if (!showGameChrome) {
      return;
    }

    this.layout(state);
    const difficulty = difficultyAt(state.elapsedMs);
    const overflow = overflowPresentationAt(state.elapsedMs);
    this.brandText.setText("await CODEX");
    this.timeText.setText(formatSurvivalTime(state.elapsedMs));
    this.bestText.setText(`BEST  ${formatSurvivalTime(localBest)}`);
    this.statusText.setText(
      state.arena.width < 640
        ? `■ SIM RUN  ·  ${state.attacksDodged.toString().padStart(3, "0")} CLEARED`
        : `■ TASK RUNNING  ·  SIM RUN  ·  ${state.attacksDodged
            .toString()
            .padStart(3, "0")} CLEARED`,
    );
    this.stageText
      .setText(
        overflow.active
          ? "STAGE 10  ·  CONTEXT // OVERFLOW"
          : `STAGE ${difficulty.stage.toString().padStart(2, "0")}`,
      )
      .setColor(overflow.active ? TEXT_COLORS.danger : TEXT_COLORS.muted);
    this.hintText.setText(
      `WASD / ARROWS  MOVE   ·   ESC  EXIT   ·   M  ${muted ? "SOUND ON" : "MUTE"}`,
    );
    this.footerText.setText(
      state.arena.width < 640
        ? "FICTIONAL TASK FEED"
        : "FICTIONAL TASK FEED  ·  NO WORKSPACE DATA IS READ",
    );
  }

  private layout(state: GameState): void {
    const { width, height } = state.arena;
    const compact = width < 640;
    const padding = compact ? 16 : Math.min(36, Math.max(24, width * 0.028));

    this.brandText.setPosition(padding, padding);
    this.statusText.setPosition(padding, padding + 21);
    this.stageText.setPosition(width / 2, padding + 1);
    this.timeText.setPosition(width - padding, padding - 3);
    this.bestText.setPosition(width - padding, padding + 27);
    this.hintText.setPosition(padding, height - Math.max(16, padding * 0.55));
    this.footerText.setPosition(
      width - padding,
      height - Math.max(16, padding * 0.55),
    );

    this.brandText.setFontSize(compact ? 11 : 12);
    this.statusText.setFontSize(compact ? 8 : 9);
    this.stageText.setFontSize(compact ? 8 : 9);
    this.timeText.setFontSize(compact ? 19 : 24);
    this.bestText.setFontSize(compact ? 8 : 9);
    this.hintText.setFontSize(compact ? 7 : 8);
    this.footerText.setFontSize(compact ? 7 : 8);
  }

  private text(
    scene: Phaser.Scene,
    x: number,
    y: number,
    size: number,
    color: string,
    resolution: number,
    fontFamily: string = FONTS.sans,
  ): Phaser.GameObjects.Text {
    return scene.add
      .text(x, y, "", {
        color,
        fontFamily,
        fontSize: `${size}px`,
      })
      .setResolution(resolution);
  }
}
