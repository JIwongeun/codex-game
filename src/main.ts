import Phaser from "phaser";

import { gameConfig } from "./game/config";
import "./styles.css";

const gameRoot = document.querySelector<HTMLDivElement>("#game-root");

if (!gameRoot) {
  throw new Error("Game root element was not found.");
}

const game = new Phaser.Game(gameConfig);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.destroy(true);
  });
}

