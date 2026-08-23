import type { GameState, HitSource } from "../core/model";
import { formatSurvivalTime } from "../core/rules";

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
      <div class="ready-overlay__signals" aria-hidden="true">
        <span class="ready-signal ready-signal--terminal ready-signal--one">$ pnpm test --watch</span>
        <span class="ready-signal ready-signal--codex ready-signal--two">[context] 84% used</span>
        <span class="ready-signal ready-signal--error ready-signal--three">error: merge conflict</span>
        <span class="ready-signal ready-signal--browser ready-signal--four">ERR_CONNECTION_REFUSED</span>
        <span class="ready-signal ready-signal--success ready-signal--five">git: branch created</span>
        <span class="ready-signal ready-signal--codex ready-signal--six">codex: reading AGENTS.md</span>
        <span class="ready-signal ready-signal--warning ready-signal--seven">warning: one more change</span>
        <span class="ready-signal ready-signal--browser ready-signal--eight">404 /api/approval</span>
      </div>

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
}
