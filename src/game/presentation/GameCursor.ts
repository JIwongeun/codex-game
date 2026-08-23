import type { Vec2 } from "../core/model";

const CURSOR_SIZE = 32;
const CURSOR_HOTSPOT = { x: 2, y: 1 } as const;
const CURSOR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAo0lEQVR4nO3X0QrAIAgFUL/B///QQQ8bewgkpq3Sa4wFPXu6lBUREZVynHVSxrgLM3MeogLSEBKQgmgBcMQTAIrQADCEBYAgegCJCIG8AYSmMQIIQYwC3BEzAFfELMANsQJwQawClhEegIoIBchmpE03gHVBTRUZAcgVwTuhLABLQXsTwlKwNhF0L2i48LugB/hT2DYF+NO9Pa4pP6jUT+wnxwVD3a6krmvEagAAAABJRU5ErkJggg==";
const LIVE_CURSOR = `url("${CURSOR_DATA_URL}") ${CURSOR_HOTSPOT.x} ${CURSOR_HOTSPOT.y}, default`;

export class GameCursor {
  private readonly frozenCursor: HTMLImageElement;
  private paused: boolean | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    container: HTMLElement,
  ) {
    this.frozenCursor = document.createElement("img");
    this.frozenCursor.className = "game-cursor-anchor";
    this.frozenCursor.src = CURSOR_DATA_URL;
    this.frozenCursor.width = CURSOR_SIZE;
    this.frozenCursor.height = CURSOR_SIZE;
    this.frozenCursor.alt = "";
    this.frozenCursor.hidden = true;
    this.frozenCursor.setAttribute("aria-hidden", "true");
    container.append(this.frozenCursor);
  }

  render(paused: boolean, position: Vec2): void {
    if (this.paused !== paused) {
      this.paused = paused;
      this.canvas.style.cursor = paused ? "default" : LIVE_CURSOR;
    }

    this.frozenCursor.hidden = !paused;

    if (paused) {
      const left = Math.round(position.x - CURSOR_HOTSPOT.x);
      const top = Math.round(position.y - CURSOR_HOTSPOT.y);
      this.frozenCursor.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    }
  }

  destroy(): void {
    this.canvas.style.removeProperty("cursor");
    this.frozenCursor.remove();
  }
}
