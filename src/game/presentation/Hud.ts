import Phaser from "phaser";

import type { GameState, HitSource } from "../core/model";
import { difficultyAt, formatSurvivalTime } from "../core/rules";
import { COLORS, FONTS, TEXT_COLORS } from "./theme";

const SOURCE_LABEL: Record<HitSource, string> = {
  log: "ONE MORE CHANGE",
  review: "REVIEW REQUEST",
  "context-max": "CONTEXT MAX",
  retry: "RETRY LOOP",
  branch: "BRANCH",
  race: "RACE CONDITION",
  bug: "MERGE BUG",
};

export class Hud {
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly brandText: Phaser.GameObjects.Text;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly timeText: Phaser.GameObjects.Text;
  private readonly bestText: Phaser.GameObjects.Text;
  private readonly hintText: Phaser.GameObjects.Text;
  private readonly footerText: Phaser.GameObjects.Text;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly subtitleText: Phaser.GameObjects.Text;
  private readonly detailText: Phaser.GameObjects.Text;
  private readonly actionText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.overlay = scene.add.graphics().setDepth(30);
    this.brandText = this.text(scene, 0, 0, 12, TEXT_COLORS.ink)
      .setFontStyle("700")
      .setLetterSpacing(0.7)
      .setDepth(32);
    this.statusText = this.text(scene, 0, 0, 9, TEXT_COLORS.muted)
      .setFontStyle("620")
      .setLetterSpacing(0.6)
      .setDepth(21);
    this.timeText = this.text(scene, 0, 0, 24, TEXT_COLORS.ink)
      .setFontStyle("680")
      .setLetterSpacing(0.7)
      .setOrigin(1, 0)
      .setDepth(21);
    this.bestText = this.text(scene, 0, 0, 9, TEXT_COLORS.faint)
      .setFontStyle("560")
      .setLetterSpacing(0.5)
      .setOrigin(1, 0)
      .setDepth(21);
    this.hintText = this.text(scene, 0, 0, 8, TEXT_COLORS.muted)
      .setFontStyle("580")
      .setLetterSpacing(0.6)
      .setOrigin(0, 1)
      .setDepth(21);
    this.footerText = this.text(scene, 0, 0, 9, TEXT_COLORS.faint)
      .setFontStyle("580")
      .setLetterSpacing(0.55)
      .setOrigin(1, 1)
      .setDepth(32);
    this.titleText = this.text(scene, 0, 0, 56, TEXT_COLORS.ink, FONTS.sans)
      .setFontStyle("720")
      .setLetterSpacing(-1.2)
      .setDepth(31);
    this.subtitleText = this.text(scene, 0, 0, 18, TEXT_COLORS.muted, FONTS.sans)
      .setFontStyle("480")
      .setDepth(31);
    this.detailText = this.text(scene, 0, 0, 14, TEXT_COLORS.ink, FONTS.sans)
      .setFontStyle("500")
      .setLineSpacing(9)
      .setDepth(31);
    this.actionText = this.text(scene, 0, 0, 13, TEXT_COLORS.ink, FONTS.sans)
      .setFontStyle("700")
      .setLetterSpacing(0.65)
      .setDepth(31);
  }

  render(state: GameState, localBest: number, muted: boolean): void {
    this.layout(state);
    const difficulty = difficultyAt(state.elapsedMs);

    this.brandText.setText("await CODEX");
    this.timeText.setText(formatSurvivalTime(state.elapsedMs));
    this.bestText.setText(`BEST  ${formatSurvivalTime(localBest)}`);
    this.statusText.setText(
      state.arena.width < 640
        ? `■ SIM RUN  ·  STAGE ${difficulty.stage.toString().padStart(2, "0")}`
        : `■ TASK RUNNING  ·  SIM RUN  ·  STAGE ${difficulty.stage
            .toString()
            .padStart(2, "0")}  ·  ${state.attacksDodged
            .toString()
            .padStart(3, "0")} CLEARED`,
    );
    this.hintText.setText(
      `WASD / ARROWS  MOVE   ·   M  ${muted ? "SOUND ON" : "MUTE"}`,
    );
    this.footerText.setText(
      state.arena.width < 640
        ? "FICTIONAL TASK FEED"
        : "FICTIONAL TASK FEED  ·  NO WORKSPACE DATA IS READ",
    );

    if (state.phase === "ready") {
      this.showOverlay(
        state,
        "Codex is working.",
        "Use the wait time.",
        `RUN  SURVIVE THE QUEUE\n\nMOVE                  WASD / ARROW KEYS\nFAIL CONDITION   ONE HIT\nLOCAL BEST          ${formatSurvivalTime(localBest)}`,
        ">  CLICK / SPACE TO RUN  █",
      );
    } else if (state.phase === "results") {
      const source = state.lastHitSource
        ? SOURCE_LABEL[state.lastHitSource]
        : "UNKNOWN INTERRUPTION";
      this.showOverlay(
        state,
        "Task interrupted.",
        `${source} reached the agent.`,
        `ELAPSED             ${formatSurvivalTime(state.elapsedMs)}\nLOCAL BEST       ${formatSurvivalTime(
          localBest,
        )}\nTOOL CALLS       ${state.attacksDodged}\nAREA EVENTS    ${state.hazardsSurvived}\n\nerror: simulated process exited with code 1`,
        ">  CLICK / SPACE TO RE-RUN  █",
      );
    } else {
      this.hideOverlay();
    }
  }

  private layout(state: GameState): void {
    const { width, height } = state.arena;
    const compact = width < 640;
    const padding = compact ? 16 : Math.min(36, Math.max(24, width * 0.028));

    this.brandText.setPosition(padding, padding);
    this.statusText.setPosition(padding, padding + 21);
    this.timeText.setPosition(width - padding, padding - 3);
    this.bestText.setPosition(width - padding, padding + 27);
    this.hintText.setPosition(padding, height - Math.max(16, padding * 0.55));
    this.footerText.setPosition(
      width - padding,
      height - Math.max(16, padding * 0.55),
    );

    this.brandText.setFontSize(compact ? 11 : 12);
    this.statusText.setFontSize(compact ? 8 : 9);
    this.timeText.setFontSize(compact ? 19 : 24);
    this.bestText.setFontSize(compact ? 8 : 9);
    this.hintText.setFontSize(compact ? 7 : 8);
    this.footerText.setFontSize(compact ? 7 : 8);
  }

  private showOverlay(
    state: GameState,
    title: string,
    subtitle: string,
    detail: string,
    action: string,
  ): void {
    const { width, height } = state.arena;
    const compact = width < 640;
    const contentX = compact
      ? 26
      : Math.max(72, Math.min(230, Math.round(width * 0.16)));
    const contentY = compact
      ? Math.max(116, Math.round(height * 0.16))
      : Math.max(142, Math.round(height * 0.2));
    const wrapWidth = Math.max(250, Math.min(760, width - contentX - 28));
    const titleSize = compact ? 36 : Math.min(62, Math.max(50, width / 22));

    this.overlay.setVisible(true).clear();
    this.overlay.fillStyle(COLORS.background, 1);
    this.overlay.fillRect(0, 0, width, height);
    this.overlay.lineStyle(1, COLORS.border, 1);
    this.overlay.lineBetween(contentX, contentY - 36, Math.min(width - 26, contentX + 62), contentY - 36);
    this.drawAgentPrompt(contentX, contentY - 70);

    this.titleText
      .setPosition(contentX, contentY)
      .setFontSize(titleSize)
      .setWordWrapWidth(wrapWidth)
      .setText(title)
      .setVisible(true);
    this.subtitleText
      .setPosition(contentX + 2, contentY + titleSize + 18)
      .setFontSize(compact ? 15 : 18)
      .setWordWrapWidth(wrapWidth)
      .setText(subtitle)
      .setVisible(true);
    this.detailText
      .setPosition(contentX + 2, contentY + titleSize + 80)
      .setFontSize(compact ? 12 : 14)
      .setWordWrapWidth(wrapWidth)
      .setText(detail)
      .setVisible(true);
    this.actionText
      .setPosition(
        contentX + 2,
        Math.min(height - 66, contentY + titleSize + (compact ? 270 : 286)),
      )
      .setFontSize(compact ? 11 : 13)
      .setText(action)
      .setVisible(true);
  }

  private drawAgentPrompt(x: number, y: number): void {
    this.overlay.fillStyle(COLORS.black, 1);
    this.overlay.fillRect(x, y + 4, 6, 12);
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
    fontFamily: string = FONTS.sans,
  ): Phaser.GameObjects.Text {
    return scene.add.text(x, y, "", {
      color,
      fontFamily,
      fontSize: `${size}px`,
    });
  }
}
