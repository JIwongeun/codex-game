import Phaser from "phaser";

import { GameScene } from "./scenes/GameScene";

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-root",
  width: Math.max(1, window.innerWidth),
  height: Math.max(1, window.innerHeight),
  backgroundColor: "#fbfbf8",
  render: {
    antialias: false,
    pixelArt: true,
    roundPixels: true,
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  scene: [GameScene],
};
