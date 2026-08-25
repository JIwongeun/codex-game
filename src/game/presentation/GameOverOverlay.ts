import type { GameState, HitSource } from "../core/model";
import { formatSurvivalTime } from "../core/rules";
import { hitSourceLabel } from "./hitSourceLabel";
import { ATTACK_TONES } from "./theme";

export interface GameOverView {
  time: string;
  source: string;
  newBest: boolean;
}

export interface GameOverFocusView {
  leftPercent: number;
  topPercent: number;
  tone: string;
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

export function gameOverFocusView(
  state: Pick<GameState, "arena" | "player" | "lastHitSource">,
): GameOverFocusView | null {
  if (!state.lastHitSource) {
    return null;
  }

  return {
    leftPercent: (state.player.position.x / state.arena.width) * 100,
    topPercent: (state.player.position.y / state.arena.height) * 100,
    tone: hitFocusTone(state.lastHitSource),
  };
}

function hitFocusTone(source: HitSource): string {
  if (source === "tool-call") {
    return ATTACK_TONES.terminalCommand.text;
  }
  if (source === "access") {
    return ATTACK_TONES.downloadAccess.text;
  }
  return ATTACK_TONES.codex.text;
}

export class GameOverOverlay {
  private readonly root: HTMLElement;
  private readonly time: HTMLElement;
  private readonly source: HTMLElement;
  private readonly best: HTMLElement;
  private readonly hitFocus: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("section");
    this.root.className = "game-over-overlay";
    this.root.hidden = true;
    this.root.setAttribute("aria-live", "assertive");
    this.root.setAttribute("aria-label", "Game over");
    this.root.innerHTML = `
      <div class="game-over-overlay__hit-focus" data-game-over-hit-focus aria-hidden="true" hidden>
        <span class="game-over-overlay__hit-focus-marker">
          <span class="game-over-overlay__hit-focus-node"></span>
        </span>
      </div>
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
    const hitFocus = this.root.querySelector<HTMLElement>(
      "[data-game-over-hit-focus]",
    );
    if (!time || !source || !best || !hitFocus) {
      throw new Error("Game over overlay targets were not found.");
    }

    this.time = time;
    this.source = source;
    this.best = best;
    this.hitFocus = hitFocus;
    parent.append(this.root);
  }

  render(visible: boolean, state: GameState, newBest: boolean): void {
    this.root.hidden = !visible;
    this.hitFocus.hidden = true;
    if (!visible) {
      return;
    }

    const focusView = gameOverFocusView(state);
    if (focusView) {
      const overlayHeight = this.root.getBoundingClientRect().height;
      const scale = overlayHeight > 0 ? overlayHeight / state.arena.height : 1;
      this.hitFocus.style.left = `${focusView.leftPercent}%`;
      this.hitFocus.style.top = `${focusView.topPercent}%`;
      this.hitFocus.style.setProperty("--game-over-hit-tone", focusView.tone);
      this.hitFocus.style.setProperty("--game-over-focus-scale", `${scale}`);
      this.hitFocus.hidden = false;
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
