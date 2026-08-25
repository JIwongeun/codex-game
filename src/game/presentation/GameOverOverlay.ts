import type { GameState } from "../core/model";
import { formatSurvivalTime } from "../core/rules";
import { GameOverHitLayer } from "./GameOverHitLayer";
import { hitSourceLabel } from "./hitSourceLabel";

export interface GameOverView {
  time: string;
  source: string;
  newBest: boolean;
}

export function gameOverView(
  state: Pick<GameState, "elapsedMs" | "lastHitSource">,
  newBest: boolean,
): GameOverView {
  return {
    time: formatSurvivalTime(state.elapsedMs),
    source: hitSourceLabel(state.lastHitSource),
    newBest,
  };
}

export class GameOverOverlay {
  private readonly root: HTMLElement;
  private readonly time: HTMLElement;
  private readonly source: HTMLElement;
  private readonly best: HTMLElement;
  private readonly hitLayer: GameOverHitLayer;

  constructor(parent: HTMLElement, gameCanvas: HTMLCanvasElement) {
    this.root = document.createElement("section");
    this.root.className = "game-over-overlay";
    this.root.hidden = true;
    this.root.setAttribute("aria-live", "assertive");
    this.root.setAttribute("aria-label", "Game over");
    this.root.innerHTML = `
      <canvas class="game-over-overlay__hit-layer" data-game-over-hit-layer aria-hidden="true"></canvas>
      <div class="game-over-overlay__copy">
        <h2>GAME OVER</h2>
        <p class="game-over-overlay__fault">
          <span class="game-over-overlay__fault-marker" aria-hidden="true"></span>
          <strong>[context]</strong>
          <span>overflow</span>
          <span class="game-over-overlay__code">// exit code 1</span>
        </p>
        <p class="game-over-overlay__time" data-game-over-time></p>
        <p class="game-over-overlay__source">HIT BY&nbsp;&nbsp;<strong data-game-over-source></strong></p>
        <p class="game-over-overlay__best" data-game-over-best>NEW SESSION BEST</p>
        <div class="game-over-overlay__actions">
          <p><strong>CLICK / SPACE</strong><span>RETRY</span></p>
          <p><strong>ESC</strong><span>START SCREEN</span></p>
        </div>
      </div>
    `;

    const time = this.root.querySelector<HTMLElement>("[data-game-over-time]");
    const source = this.root.querySelector<HTMLElement>(
      "[data-game-over-source]",
    );
    const best = this.root.querySelector<HTMLElement>("[data-game-over-best]");
    const hitCanvas = this.root.querySelector<HTMLCanvasElement>(
      "[data-game-over-hit-layer]",
    );
    if (!time || !source || !best || !hitCanvas) {
      throw new Error("Game over overlay targets were not found.");
    }

    this.time = time;
    this.source = source;
    this.best = best;
    this.hitLayer = new GameOverHitLayer(hitCanvas, gameCanvas);
    parent.append(this.root);
  }

  render(visible: boolean, state: GameState, newBest: boolean): void {
    this.root.hidden = !visible;
    this.hitLayer.render(visible, state);
    if (!visible) {
      return;
    }

    const view = gameOverView(state, newBest);
    this.time.textContent = `RUN TERMINATED  ·  ${view.time}`;
    this.source.textContent = view.source;
    this.best.hidden = !view.newBest;
  }

  destroy(): void {
    this.root.remove();
  }
}
