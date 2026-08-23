import { formatSurvivalTime } from "../core/rules";

export class PauseOverlay {
  private readonly element: HTMLElement;
  private readonly timeText: HTMLElement;

  constructor(container: HTMLElement) {
    this.element = document.createElement("section");
    this.element.className = "pause-overlay";
    this.element.hidden = true;
    this.element.setAttribute("aria-live", "polite");
    this.element.setAttribute("aria-label", "Game paused");

    const copy = document.createElement("div");
    copy.className = "pause-overlay__copy";

    const title = document.createElement("p");
    title.className = "pause-overlay__title";
    title.textContent = "PAUSED";

    this.timeText = document.createElement("p");
    this.timeText.className = "pause-overlay__time";

    const action = document.createElement("p");
    action.className = "pause-overlay__action";
    action.textContent = "//  CLICK / SPACE TO RESUME";

    copy.append(title, this.timeText, action);
    this.element.append(copy);
    container.append(this.element);
  }

  render(paused: boolean, elapsedMs: number): void {
    this.element.hidden = !paused;

    if (paused) {
      this.timeText.textContent = `SURVIVED  ${formatSurvivalTime(elapsedMs)}`;
    }
  }

  destroy(): void {
    this.element.remove();
  }
}
