import Phaser from "phaser";

import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import type { GameState, HitSource } from "../core/model";
import { difficultyAt, formatSurvivalTime } from "../core/rules";
import { COLORS, FONTS, TEXT_COLORS } from "./theme";

const SOURCE_LABEL: Record<HitSource, string> = {
  tab: "TAB STORM",
  popup: "POP-UP",
  "memory-leak": "MEMORY LEAK",
  "context-sweep": "CONTEXT OVERFLOW",
};

export class Hud {
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly brandText: Phaser.GameObjects.Text;
  private readonly timeText: Phaser.GameObjects.Text;
  private readonly bestText: Phaser.GameObjects.Text;
  private readonly levelText: Phaser.GameObjects.Text;
  private readonly hintText: Phaser.GameObjects.Text;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly subtitleText: Phaser.GameObjects.Text;
  private readonly detailText: Phaser.GameObjects.Text;
  private readonly actionText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.overlay = scene.add.graphics().setDepth(30);
    this.brandText = this.text(scene, 42, 23, 16, TEXT_COLORS.ink).setDepth(21);
    this.timeText = this.text(
      scene,
      GAME_WIDTH - 42,
      22,
      20,
      TEXT_COLORS.ink,
    )
      .setOrigin(1, 0)
      .setDepth(21);
    this.bestText = this.text(
      scene,
      GAME_WIDTH - 42,
      51,
      13,
      TEXT_COLORS.muted,
    )
      .setOrigin(1, 0)
      .setDepth(21);
    this.levelText = this.text(scene, 42, 51, 13, TEXT_COLORS.muted).setDepth(21);
    this.hintText = this.text(
      scene,
      42,
      GAME_HEIGHT - 17,
      12,
      TEXT_COLORS.faint,
    )
      .setOrigin(0, 1)
      .setDepth(21);
    this.titleText = this.text(
      scene,
      258,
      178,
      48,
      TEXT_COLORS.ink,
      FONTS.mono,
    ).setDepth(31);
    this.subtitleText = this.text(
      scene,
      260,
      248,
      18,
      TEXT_COLORS.muted,
      FONTS.sans,
    ).setDepth(31);
    this.detailText = this.text(
      scene,
      260,
      330,
      17,
      TEXT_COLORS.ink,
      FONTS.sans,
    )
      .setLineSpacing(11)
      .setDepth(31);
    this.actionText = this.text(
      scene,
      260,
      562,
      16,
      TEXT_COLORS.accent,
      FONTS.sans,
    ).setDepth(31);
  }

  render(
    state: GameState,
    localBest: number,
    focusPaused: boolean,
    muted: boolean,
  ): void {
    const difficulty = difficultyAt(state.elapsedMs);
    this.brandText.setText("await CODEX");
    this.timeText.setText(formatSurvivalTime(state.elapsedMs));
    this.bestText.setText(`best  ${formatSurvivalTime(localBest)}`);
    this.levelText.setText(
      `level ${difficulty.level.toString().padStart(2, "0")}  ·  ${this.stageLabel(
        state.elapsedMs,
      )}`,
    );
    this.hintText.setText(
      `move  mouse / WASD / arrows     avoid everything     M  ${
        muted ? "UNMUTE" : "MUTE"
      }`,
    );

    if (focusPaused) {
      this.showOverlay(
        "This tab is paused",
        "Your run is safe.",
        `생존 기록  ${formatSurvivalTime(state.elapsedMs)}\n\n게임과 타이머를 잠시 멈췄습니다.\n돌아오면 중단한 지점에서 계속됩니다.`,
        "클릭하거나 Space를 눌러 계속",
      );
    } else if (state.phase === "ready") {
      this.showOverlay(
        "await CODEX",
        "Codex is taking longer than expected.",
        `포인터를 움직여 들어오는 요청을 피하세요.\n한 번 닿으면 run이 종료됩니다.\n\n마우스 / WASD / 방향키로 이동\n오래 버틸수록 더 큰 오류가 나타납니다.\n\n브라우저 최고 기록  ${formatSurvivalTime(
          localBest,
        )}`,
        "클릭하거나 Space를 눌러 run 시작",
      );
    } else if (state.phase === "results") {
      const source = state.lastHitSource
        ? SOURCE_LABEL[state.lastHitSource]
        : "UNKNOWN ERROR";
      this.showOverlay(
        "Pointer crashed",
        `${source} interrupted the run.`,
        `생존  ${formatSurvivalTime(state.elapsedMs)}\n브라우저 최고 기록  ${formatSurvivalTime(
          localBest,
        )}\n\n회피한 요청  ${state.attacksDodged}\n버틴 범위 공격  ${state.hazardsSurvived}`,
        "클릭하거나 Space를 눌러 다시 시작",
      );
    } else {
      this.hideOverlay();
    }
  }

  private stageLabel(elapsedMs: number): string {
    if (elapsedMs >= 42_000) {
      return "context overflow";
    }
    if (elapsedMs >= 24_000) {
      return "memory pressure";
    }
    if (elapsedMs >= 12_000) {
      return "pop-ups enabled";
    }
    return "incoming tabs";
  }

  private showOverlay(
    title: string,
    subtitle: string,
    detail: string,
    action: string,
  ): void {
    this.overlay.setVisible(true).clear();
    this.overlay.fillStyle(COLORS.background, 0.98);
    this.overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.overlay.lineStyle(5, COLORS.text, 1);
    this.overlay.lineBetween(260, 124, 278, 140);
    this.overlay.lineBetween(278, 140, 260, 156);
    this.overlay.lineBetween(284, 156, 304, 156);
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
    fontFamily: string = FONTS.mono,
  ): Phaser.GameObjects.Text {
    return scene.add.text(x, y, "", {
      color,
      fontFamily,
      fontSize: `${size}px`,
      wordWrap: { width: 760 },
    });
  }
}
