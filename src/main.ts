import Phaser from "phaser";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";

import { gameConfig } from "./game/config";
import "./styles.css";

const gameRoot = document.querySelector<HTMLDivElement>("#game-root");

if (!gameRoot) {
  throw new Error("Game root element was not found.");
}

let game: Phaser.Game | null = null;

async function bootGame(): Promise<void> {
  await document.fonts.load(
    '500 16px "Pretendard Variable"',
    "await CODEX Pointer crashed 포인터",
  );
  game = new Phaser.Game(gameConfig);
}

void bootGame();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game?.destroy(true);
    game = null;
  });
}
