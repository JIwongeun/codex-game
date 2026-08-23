import type { AttackSurface, GameState, HitSource } from "../core/model";
import { formatSurvivalTime } from "../core/rules";
import { attackTextColor, attackTextTokens } from "./attackText";

interface AmbientSignal {
  label: string;
  surface: AttackSurface;
}

export interface AmbientPath {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  angleDeg: number;
  durationSeconds: number;
  delaySeconds: number;
}

const AMBIENT_SIGNALS: readonly AmbientSignal[] = [
  { label: '$ git commit -m "fix"', surface: "terminal" },
  { label: "$ pnpm test --watch", surface: "terminal" },
  { label: "[context] 84% used", surface: "codex" },
  { label: "[review] changes requested", surface: "codex" },
  { label: "codex: reading AGENTS.md", surface: "codex" },
  { label: "404 Not Found", surface: "browser" },
  { label: "ERR_CONNECTION_REFUSED", surface: "browser" },
  { label: "net::ERR_FAILED", surface: "browser" },
];

export function createAmbientPath(
  random: () => number,
  viewportWidth: number,
  viewportHeight: number,
): AmbientPath {
  const startEdge = Math.floor(random() * 4) % 4;
  const endEdge = (startEdge + 2) % 4;
  const start = pointOnViewportEdge(startEdge, random());
  const end = pointOnViewportEdge(endEdge, random());
  const angleRadians = Math.atan2(
    ((end.y - start.y) * viewportHeight) / 100,
    ((end.x - start.x) * viewportWidth) / 100,
  );
  let angleDeg = (angleRadians * 180) / Math.PI;
  if (angleDeg > 90 || angleDeg < -90) {
    angleDeg += 180;
  }
  const durationSeconds = 34 + random() * 22;
  const delaySeconds = random() * durationSeconds;

  return {
    startX: start.x,
    startY: start.y,
    endX: end.x,
    endY: end.y,
    angleDeg,
    durationSeconds,
    delaySeconds: delaySeconds === 0 ? 0 : -delaySeconds,
  };
}

function pointOnViewportEdge(
  edge: number,
  along: number,
): { x: number; y: number } {
  const inset = 8 + along * 84;
  if (edge === 0) {
    return { x: -18, y: inset };
  }
  if (edge === 1) {
    return { x: inset, y: -12 };
  }
  if (edge === 2) {
    return { x: 112, y: inset };
  }
  return { x: inset, y: 106 };
}

const HIT_SOURCE_LABEL: Record<HitSource, string> = {
  log: "ONE MORE CHANGE",
  review: "REVIEW REQUEST",
  "context-max": "CONTEXT MAX",
  retry: "RETRY LOOP",
  branch: "BRANCH",
  race: "RACE CONDITION",
  bug: "MERGE BUG",
};

export interface StartScreenView {
  visible: boolean;
  best: string;
  lastRun: string;
  actionSuffix: "TO START RUN" | "TO START NEW RUN";
}

export function startScreenView(
  state: GameState,
  localBest: number,
): StartScreenView {
  const completedRun = state.phase === "results";
  const hitSource = state.lastHitSource
    ? HIT_SOURCE_LABEL[state.lastHitSource]
    : "UNKNOWN INTERRUPTION";

  return {
    visible: state.phase !== "playing",
    best: formatSurvivalTime(localBest),
    lastRun: completedRun
      ? `${formatSurvivalTime(state.elapsedMs)} / ${hitSource}`
      : "--:--.-- / NO RUN YET",
    actionSuffix: completedRun ? "TO START NEW RUN" : "TO START RUN",
  };
}

export class ReadyOverlay {
  private readonly root: HTMLElement;
  private readonly bestValue: HTMLElement;
  private readonly lastRunValue: HTMLElement;
  private readonly actionSuffix: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("section");
    this.root.className = "ready-overlay";
    this.root.setAttribute("aria-label", "await CODEX 시작 화면");
    this.root.innerHTML = `
      <div class="ready-overlay__signals" aria-hidden="true"></div>

      <header class="ready-header">
        <div class="ready-brand">
          <div class="ready-brand__mark" aria-hidden="true"><span></span></div>
          <div class="ready-brand__copy">
            <strong>await CODEX</strong>
            <span>CONTEXT//OVERFLOW</span>
          </div>
        </div>
        <div class="ready-status">
          <span class="ready-status__dot" aria-hidden="true"></span>
          <span>CODEX TASK RUNNING</span>
          <span class="ready-status__mode">BACKGROUND</span>
        </div>
      </header>

      <main class="ready-hero">
        <p class="ready-hero__eyebrow">WAIT-TIME SURVIVAL&nbsp;&nbsp;/&nbsp;&nbsp;RUN 01</p>
        <h1>Codex is<br /><span>working<i>.</i></span></h1>
        <p class="ready-hero__lede">The agent has the task.<br />You have the wait time.</p>

        <dl class="ready-spec">
          <div><dt>OBJECTIVE</dt><dd>SURVIVE THE QUEUE</dd></div>
          <div><dt>CONTROL</dt><dd>WASD / ARROW KEYS</dd></div>
          <div><dt>FAIL STATE</dt><dd>ONE HIT</dd></div>
          <div><dt>LAST RUN</dt><dd data-ready-last-run>--:--.-- / NO RUN YET</dd></div>
          <div><dt>LOCAL BEST</dt><dd data-ready-best>00:00.00</dd></div>
        </dl>

        <div class="ready-action">
          <span class="ready-action__prompt" aria-hidden="true">›</span>
          <strong>CLICK OR PRESS SPACE</strong>
          <span data-ready-action-suffix>TO START RUN</span>
        </div>
      </main>

      <footer class="ready-footer">
        <span>PLAY WHILE CODEX WORKS</span>
        <span>FICTIONAL TASK FEED&nbsp;&nbsp;·&nbsp;&nbsp;NO WORKSPACE DATA IS READ</span>
      </footer>
    `;

    const bestValue = this.root.querySelector<HTMLElement>("[data-ready-best]");
    const lastRunValue = this.root.querySelector<HTMLElement>(
      "[data-ready-last-run]",
    );
    const actionSuffix = this.root.querySelector<HTMLElement>(
      "[data-ready-action-suffix]",
    );
    if (!bestValue || !lastRunValue || !actionSuffix) {
      throw new Error("Ready overlay status targets were not found.");
    }

    this.bestValue = bestValue;
    this.lastRunValue = lastRunValue;
    this.actionSuffix = actionSuffix;
    this.createAmbientSignals();
    parent.append(this.root);
  }

  render(state: GameState, localBest: number): void {
    const view = startScreenView(state, localBest);
    this.root.hidden = !view.visible;
    if (!view.visible) {
      return;
    }

    this.bestValue.textContent = view.best;
    this.lastRunValue.textContent = view.lastRun;
    this.actionSuffix.textContent = view.actionSuffix;
  }

  destroy(): void {
    this.root.remove();
  }

  private createAmbientSignals(): void {
    const layer = this.root.querySelector<HTMLElement>(
      ".ready-overlay__signals",
    );
    if (!layer) {
      throw new Error("Ready overlay ambient layer was not found.");
    }

    for (const signal of AMBIENT_SIGNALS) {
      const element = document.createElement("span");
      element.className = `ready-signal ready-signal--${signal.surface}`;
      if (signal.surface !== "terminal") {
        const mark = document.createElement("i");
        mark.className = `ready-signal__mark ready-signal__mark--${signal.surface}`;
        element.append(mark);
      }
      for (const part of attackTextTokens(signal.surface, signal.label)) {
        const text = document.createElement("span");
        text.textContent = part.text;
        text.style.color = attackTextColor(part.role);
        element.append(text);
      }

      this.applyAmbientPath(element, true);
      element.addEventListener("animationiteration", () => {
        this.applyAmbientPath(element, false);
      });
      layer.append(element);
    }
  }

  private applyAmbientPath(element: HTMLElement, initial: boolean): void {
    const path = createAmbientPath(
      Math.random,
      Math.max(1, window.innerWidth),
      Math.max(1, window.innerHeight),
    );
    element.style.setProperty("--ready-start-x", `${path.startX}vw`);
    element.style.setProperty("--ready-start-y", `${path.startY}vh`);
    element.style.setProperty("--ready-end-x", `${path.endX}vw`);
    element.style.setProperty("--ready-end-y", `${path.endY}vh`);
    element.style.setProperty("--ready-angle", `${path.angleDeg}deg`);
    element.style.animationDuration = `${path.durationSeconds}s`;
    element.style.animationDelay = initial ? `${path.delaySeconds}s` : "0s";
  }
}
