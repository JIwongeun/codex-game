import Phaser from "phaser";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";

import { gameConfig } from "./game/config";
import "./styles.css";

const gameRoot = document.querySelector<HTMLDivElement>("#game-root");

if (!gameRoot) {
  throw new Error("Game root element was not found.");
}

let game: Phaser.Game | null = null;

function installGameIcon(): void {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.fillStyle = "#171717";
  context.fillRect(0, 0, 32, 32);
  context.strokeStyle = "rgba(255, 255, 255, 0.32)";
  context.strokeRect(5.5, 5.5, 21, 21);
  context.save();
  context.translate(16, 16);
  context.rotate(Math.PI / 4);
  context.strokeStyle = "#ffffff";
  context.lineWidth = 2;
  context.strokeRect(-7, -7, 14, 14);
  context.restore();
  context.fillStyle = "#7863bd";
  context.fillRect(14, 14, 4, 4);

  const icon = document.createElement("link");
  icon.rel = "icon";
  icon.type = "image/png";
  icon.href = canvas.toDataURL("image/png");
  document.head.append(icon);
}

async function bootGame(): Promise<void> {
  await document.fonts.load(
    '500 16px "Pretendard Variable"',
    "await CODEX Pointer crashed 포인터",
  );
  game = new Phaser.Game(gameConfig);
}

installGameIcon();
void bootGame();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game?.destroy(true);
    game = null;
  });
}
