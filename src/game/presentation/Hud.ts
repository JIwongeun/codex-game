import Phaser from "phaser";

import type { GameEvent, GameState, HitSource } from "../core/model";
import { difficultyAt, formatSurvivalTime } from "../core/rules";
import { COLORS, FONTS, TEXT_COLORS } from "./theme";

const SOURCE_LABEL: Record<HitSource, string> = {
  tab: "TAB STORM",
  popup: "POP-UP",
  "memory-leak": "MEMORY LEAK",
  "context-sweep": "CONTEXT OVERFLOW",
};

interface Announcement {
  text: string;
  untilElapsedMs: number;
}

export class Hud {
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly brandText: Phaser.GameObjects.Text;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly timeText: Phaser.GameObjects.Text;
  private readonly bestText: Phaser.GameObjects.Text;
  private readonly hintText: Phaser.GameObjects.Text;
  private readonly alertText: Phaser.GameObjects.Text;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly subtitleText: Phaser.GameObjects.Text;
  private readonly detailText: Phaser.GameObjects.Text;
  private readonly actionText: Phaser.GameObjects.Text;
  private announcement: Announcement | null = null;

  constructor(scene: Phaser.Scene) {
    this.overlay = scene.add.graphics().setDepth(30);
    this.brandText = this.text(scene, 0, 0, 15, TEXT_COLORS.ink).setDepth(21);
    this.statusText = this.text(scene, 0, 0, 12, TEXT_COLORS.muted).setDepth(21);
    this.timeText = this.text(scene, 0, 0, 28, TEXT_COLORS.ink)
      .setOrigin(1, 0)
      .setDepth(21);
    this.bestText = this.text(scene, 0, 0, 12, TEXT_COLORS.faint)
      .setOrigin(1, 0)
      .setDepth(21);
    this.hintText = this.text(scene, 0, 0, 11, TEXT_COLORS.faint)
      .setOrigin(0, 1)
      .setDepth(21);
    this.alertText = this.text(scene, 0, 0, 12, TEXT_COLORS.danger)
      .setOrigin(0.5, 0)
      .setDepth(22);
    this.titleText = this.text(scene, 0, 0, 48, TEXT_COLORS.ink, FONTS.mono)
      .setDepth(31);
    this.subtitleText = this.text(scene, 0, 0, 18, TEXT_COLORS.muted, FONTS.sans)
      .setDepth(31);
    this.detailText = this.text(scene, 0, 0, 16, TEXT_COLORS.ink, FONTS.sans)
      .setLineSpacing(10)
      .setDepth(31);
    this.actionText = this.text(scene, 0, 0, 14, TEXT_COLORS.accent, FONTS.mono)
      .setDepth(31);
  }

  consume(events: readonly GameEvent[], state: GameState): void {
    for (const event of events) {
      if (event.type === "hazard-warning") {
        this.announcement = {
          text:
            event.kind === "memory-leak"
              ? "MEMORY LEAK  ·  AREA LOCKING"
              : "CONTEXT OVERFLOW  ·  CLEAR THE BAND",
          untilElapsedMs: state.elapsedMs + 1_250,
        };
      } else if (event.type === "hazard-activated") {
        this.announcement = {
          text:
            event.kind === "memory-leak"
              ? "MEMORY LEAK  ·  ACTIVE"
              : "CONTEXT OVERFLOW  ·  ACTIVE",
          untilElapsedMs: state.elapsedMs + 650,
        };
      } else if (event.type === "run-started") {
        this.announcement = null;
      }
    }
  }

  render(
    state: GameState,
    localBest: number,
    focusPaused: boolean,
    muted: boolean,
  ): void {
    this.layout(state);
    const difficulty = difficultyAt(state.elapsedMs);

    this.brandText.setText("await CODEX");
    this.timeText.setText(formatSurvivalTime(state.elapsedMs));
    this.bestText.setText(`BEST  ${formatSurvivalTime(localBest)}`);
    this.statusText.setText(
      state.arena.width < 640
        ? `L${difficulty.level.toString().padStart(2, "0")}  ·  ${state.attacksDodged
            .toString()
            .padStart(3, "0")} CLEARED`
        : `RUNNING  ·  L${difficulty.level.toString().padStart(2, "0")}  ·  ${state.attacksDodged
            .toString()
            .padStart(3, "0")} REQUESTS CLEARED`,
    );
    this.hintText.setText(`POINTER = YOU   ·   M  ${muted ? "SOUND ON" : "MUTE"}`);
    this.renderAnnouncement(state);

    if (focusPaused) {
      this.showOverlay(
        state,
        "This tab is paused.",
        "Your run is safe.",
        `SURVIVED  ${formatSurvivalTime(state.elapsedMs)}\n\nThe timer and every incoming request are frozen.\nReturn when Codex needs a little more time.`,
        "CLICK / SPACE TO RESUME",
      );
    } else if (state.phase === "ready") {
      this.showOverlay(
        state,
        "await CODEX",
        "Codex is taking longer than expected.",
        `The pointer is you.\nAvoid every tab, pop-up, and browser error.\nOne hit ends the run.\n\nLOCAL BEST  ${formatSurvivalTime(localBest)}`,
        "CLICK / SPACE TO START",
      );
    } else if (state.phase === "results") {
      const source = state.lastHitSource
        ? SOURCE_LABEL[state.lastHitSource]
        : "UNKNOWN ERROR";
      this.showOverlay(
        state,
        "Pointer crashed.",
        `${source} interrupted the run.`,
        `SURVIVED  ${formatSurvivalTime(state.elapsedMs)}\nLOCAL BEST  ${formatSurvivalTime(
          localBest,
        )}\n\n${state.attacksDodged} requests cleared\n${state.hazardsSurvived} area errors survived`,
        "CLICK / SPACE TO TRY AGAIN",
      );
    } else {
      this.hideOverlay();
    }
  }

  private layout(state: GameState): void {
    const { width, height } = state.arena;
    const compact = width < 640;
    const padding = compact ? 20 : Math.min(44, Math.max(28, width * 0.035));

    this.brandText.setPosition(padding, padding);
    this.statusText.setPosition(padding, padding + 27);
    this.timeText.setPosition(width - padding, padding - 3);
    this.bestText.setPosition(width - padding, padding + 34);
    this.hintText.setPosition(padding, height - Math.max(16, padding * 0.55));
    this.alertText.setPosition(width / 2, compact ? padding + 62 : padding + 4);

    if (compact) {
      this.brandText.setFontSize(13);
      this.statusText.setFontSize(10);
      this.timeText.setFontSize(21);
      this.bestText.setFontSize(10);
      this.hintText.setFontSize(9);
    } else {
      this.brandText.setFontSize(15);
      this.statusText.setFontSize(12);
      this.timeText.setFontSize(28);
      this.bestText.setFontSize(12);
      this.hintText.setFontSize(11);
    }
  }

  private renderAnnouncement(state: GameState): void {
    if (state.phase !== "playing") {
      this.alertText.setVisible(false);
      return;
    }

    if (this.announcement && state.elapsedMs <= this.announcement.untilElapsedMs) {
      this.alertText.setText(this.announcement.text).setVisible(true);
      return;
    }

    const popupIncoming = state.projectiles.some(
      (projectile) =>
        projectile.kind === "popup" && projectile.telegraphRemainingMs > 0,
    );
    if (popupIncoming) {
      this.alertText.setText("POP-UP BLOCKER FAILED  ·  PATH LOCKED").setVisible(true);
      return;
    }

    this.alertText.setVisible(false);
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
      : Math.max(64, Math.min(220, Math.round(width * 0.16)));
    const contentY = compact
      ? Math.max(82, Math.round(height * 0.13))
      : Math.max(108, Math.round(height * 0.18));
    const wrapWidth = Math.max(250, Math.min(720, width - contentX - 28));
    const titleSize = compact ? 34 : Math.min(50, Math.max(42, width / 24));

    this.overlay.setVisible(true).clear();
    this.overlay.fillStyle(COLORS.background, 0.985);
    this.overlay.fillRect(0, 0, width, height);
    this.drawBrokenPageIcon(contentX, contentY - 50);

    this.titleText
      .setPosition(contentX, contentY)
      .setFontSize(titleSize)
      .setWordWrapWidth(wrapWidth)
      .setText(title)
      .setVisible(true);
    this.subtitleText
      .setPosition(contentX + 2, contentY + titleSize + 20)
      .setFontSize(compact ? 15 : 18)
      .setWordWrapWidth(wrapWidth)
      .setText(subtitle)
      .setVisible(true);
    this.detailText
      .setPosition(contentX + 2, contentY + titleSize + 78)
      .setFontSize(compact ? 14 : 16)
      .setWordWrapWidth(wrapWidth)
      .setText(detail)
      .setVisible(true);
    this.actionText
      .setPosition(
        contentX + 2,
        Math.min(height - 56, contentY + titleSize + (compact ? 275 : 300)),
      )
      .setFontSize(compact ? 12 : 14)
      .setText(`›  ${action}`)
      .setVisible(true);
  }

  private drawBrokenPageIcon(x: number, y: number): void {
    this.overlay.lineStyle(2, COLORS.text, 0.92);
    this.overlay.beginPath();
    this.overlay.moveTo(x, y);
    this.overlay.lineTo(x + 21, y);
    this.overlay.lineTo(x + 30, y + 9);
    this.overlay.lineTo(x + 30, y + 34);
    this.overlay.lineTo(x, y + 34);
    this.overlay.closePath();
    this.overlay.strokePath();
    this.overlay.lineBetween(x + 21, y, x + 21, y + 9);
    this.overlay.lineBetween(x + 21, y + 9, x + 30, y + 9);
    this.overlay.fillStyle(COLORS.text, 0.9);
    this.overlay.fillRect(x + 8, y + 15, 3, 3);
    this.overlay.fillRect(x + 19, y + 15, 3, 3);
    this.overlay.lineBetween(x + 9, y + 27, x + 14, y + 23);
    this.overlay.lineBetween(x + 14, y + 23, x + 21, y + 27);
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
    fontFamily: string = FONTS.mono,
  ): Phaser.GameObjects.Text {
    return scene.add.text(x, y, "", {
      color,
      fontFamily,
      fontSize: `${size}px`,
    });
  }
}
