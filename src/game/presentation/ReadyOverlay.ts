import { formatSurvivalTime } from "../core/rules";

export class ReadyOverlay {
  private readonly root: HTMLElement;
  private readonly bestValue: HTMLElement;

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
          <div><dt>LOCAL BEST</dt><dd data-ready-best>00:00.00</dd></div>
        </dl>

        <div class="ready-action">
          <span class="ready-action__prompt" aria-hidden="true">›</span>
          <strong>CLICK OR PRESS SPACE</strong>
          <span>TO START RUN</span>
        </div>
      </main>

      <footer class="ready-footer">
        <span>PLAY WHILE CODEX WORKS</span>
        <span>FICTIONAL TASK FEED&nbsp;&nbsp;·&nbsp;&nbsp;NO WORKSPACE DATA IS READ</span>
      </footer>
    `;

    const bestValue = this.root.querySelector<HTMLElement>("[data-ready-best]");
    if (!bestValue) {
      throw new Error("Ready overlay best-score target was not found.");
    }

    this.bestValue = bestValue;
    parent.append(this.root);
  }

  render(visible: boolean, localBest: number): void {
    this.root.hidden = !visible;
    if (visible) {
      this.bestValue.textContent = formatSurvivalTime(localBest);
    }
  }

  destroy(): void {
    this.root.remove();
  }
}
