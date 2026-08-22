import Phaser from "phaser";

import { GAME_HEIGHT, GAME_WIDTH, RUN_DURATION_SECONDS } from "../constants";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(): void {
    this.drawBackgroundGrid();

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 92, "await CODEX", {
        color: "#f2f4f8",
        fontFamily: "Cascadia Code, Consolas, monospace",
        fontSize: "64px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 14, "CONTEXT//OVERFLOW", {
        color: "#68f7c1",
        fontFamily: "Cascadia Code, Consolas, monospace",
        fontSize: "28px",
        letterSpacing: 6,
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 62,
        `Development environment ready · ${RUN_DURATION_SECONDS}s run`,
        {
          color: "#8d9bad",
          fontFamily: "Cascadia Code, Consolas, monospace",
          fontSize: "18px",
        },
      )
      .setOrigin(0.5);

    const cursor = this.add
      .rectangle(GAME_WIDTH / 2 + 242, GAME_HEIGHT / 2 - 92, 8, 54, 0x68f7c1)
      .setOrigin(0.5);

    this.tweens.add({
      targets: cursor,
      alpha: 0.1,
      duration: 520,
      yoyo: true,
      repeat: -1,
    });
  }

  private drawBackgroundGrid(): void {
    const grid = this.add.graphics();
    grid.lineStyle(1, 0x1a2430, 0.5);

    for (let x = 0; x <= GAME_WIDTH; x += 40) {
      grid.lineBetween(x, 0, x, GAME_HEIGHT);
    }

    for (let y = 0; y <= GAME_HEIGHT; y += 40) {
      grid.lineBetween(0, y, GAME_WIDTH, y);
    }
  }
}

