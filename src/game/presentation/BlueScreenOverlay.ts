import type { EndingState } from "../core/model";

export class BlueScreenOverlay {
  private readonly element: HTMLDivElement;
  private readonly progressText: HTMLSpanElement;

  constructor(parent: HTMLElement) {
    this.element = document.createElement("div");
    this.element.setAttribute("aria-hidden", "true");
    Object.assign(this.element.style, {
      position: "absolute",
      inset: "0",
      zIndex: "80",
      display: "none",
      boxSizing: "border-box",
      overflow: "hidden",
      padding: "clamp(48px, 10vw, 152px)",
      background: "#0767b2",
      color: "#ffffff",
      fontFamily: '"Pretendard Variable", "Segoe UI", sans-serif',
      pointerEvents: "none",
    });

    const content = document.createElement("div");
    Object.assign(content.style, {
      maxWidth: "760px",
    });

    const face = document.createElement("div");
    face.textContent = ":(";
    Object.assign(face.style, {
      marginBottom: "28px",
      fontSize: "clamp(64px, 9vw, 112px)",
      fontWeight: "300",
      lineHeight: "0.9",
    });

    const message = document.createElement("p");
    message.textContent =
      "Your Codex task ran into a problem and had to stop.";
    Object.assign(message.style, {
      maxWidth: "680px",
      margin: "0 0 32px",
      fontSize: "clamp(20px, 2.4vw, 31px)",
      fontWeight: "360",
      lineHeight: "1.4",
    });

    const progress = document.createElement("p");
    progress.append("Collecting failure context... ");
    this.progressText = document.createElement("span");
    progress.append(this.progressText);
    Object.assign(progress.style, {
      margin: "0 0 22px",
      fontSize: "clamp(14px, 1.4vw, 18px)",
      fontWeight: "420",
      lineHeight: "1.5",
    });

    const stopCode = document.createElement("p");
    stopCode.textContent = "Stop code: TASK_CONTEXT_OVERFLOW";
    Object.assign(stopCode.style, {
      margin: "0",
      fontFamily: '"Cascadia Mono", Consolas, monospace',
      fontSize: "clamp(11px, 1.1vw, 14px)",
      letterSpacing: "0.02em",
      opacity: "0.86",
    });

    content.append(face, message, progress, stopCode);
    this.element.append(content);
    parent.append(this.element);
  }

  render(ending: EndingState | null): void {
    if (!ending) {
      this.element.style.display = "none";
      this.element.setAttribute("aria-hidden", "true");
      return;
    }

    const progress = Math.min(
      100,
      Math.max(0, Math.floor((ending.elapsedMs / ending.durationMs) * 100)),
    );
    this.progressText.textContent = `${progress}%`;
    this.element.style.display = "block";
    this.element.setAttribute("aria-hidden", "false");
  }

  destroy(): void {
    this.element.remove();
  }
}
