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
  { label: "$ rg --files -g AGENTS.md", surface: "terminal" },
  { label: "$ pnpm test --run", surface: "terminal" },
  { label: "[context] compacting 84%", surface: "codex" },
  { label: "[approval] allow full access?", surface: "codex" },
  { label: "[ultra] 8 agents running", surface: "codex" },
  { label: "[usage] 12% left", surface: "codex" },
  { label: "404 Not Found", surface: "browser" },
  { label: "ERR_CONNECTION_REFUSED", surface: "browser" },
  { label: "net::ERR_FAILED", surface: "browser" },
];

export function createAmbientPath(
  random: () => number,
  viewportWidth: number,
  viewportHeight: number,
  signalExtent: number,
): AmbientPath {
  const startEdge = Math.floor(random() * 4) % 4;
  const endEdge = (startEdge + 2) % 4;
  const start = pointOutsideViewport(
    startEdge,
    random(),
    viewportWidth,
    viewportHeight,
    signalExtent,
  );
  const end = pointOutsideViewport(
    endEdge,
    random(),
    viewportWidth,
    viewportHeight,
    signalExtent,
  );
  const angleRadians = Math.atan2(end.y - start.y, end.x - start.x);
  let angleDeg = (angleRadians * 180) / Math.PI;
  if (angleDeg > 90 || angleDeg < -90) {
    angleDeg += 180;
  }
  const durationSeconds = 34 + random() * 22;
  const delaySeconds = random() * 8;

  return {
    startX: start.x,
    startY: start.y,
    endX: end.x,
    endY: end.y,
    angleDeg,
    durationSeconds,
    delaySeconds,
  };
}

function pointOutsideViewport(
  edge: number,
  along: number,
  viewportWidth: number,
  viewportHeight: number,
  signalExtent: number,
): { x: number; y: number } {
  const inset = 0.08 + along * 0.84;
  const outside = Math.max(1, signalExtent) + 16;
  if (edge === 0) {
    return { x: -outside, y: viewportHeight * inset };
  }
  if (edge === 1) {
    return { x: viewportWidth * inset, y: -outside };
  }
  if (edge === 2) {
    return { x: viewportWidth + outside, y: viewportHeight * inset };
  }
  return { x: viewportWidth * inset, y: viewportHeight + outside };
}

const HIT_SOURCE_LABEL: Record<HitSource, string> = {
  "tool-call": "TOOL CALL",
  approval: "APPROVAL REQUIRED",
  "context-token": "LOST CONTEXT TOKEN",
  retry: "RETRY LOOP",
  reasoning: "ULTRA CODE RESPONSE",
  agent: "PARALLEL AGENT",
  finding: "ONE MORE ISSUE",
  limit: "USAGE LIMIT",
  access: "ACCESS GRANTED",
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

export function volumeStepDirection(key: string): -1 | 0 | 1 {
  if (key === "ArrowLeft" || key.toLowerCase() === "a") {
    return -1;
  }
  if (key === "ArrowRight" || key.toLowerCase() === "d") {
    return 1;
  }
  return 0;
}

export function volumeFocusDirection(key: string): -1 | 0 | 1 {
  if (key === "ArrowUp") {
    return -1;
  }
  if (key === "ArrowDown") {
    return 1;
  }
  return 0;
}

export class ReadyOverlay {
  private readonly root: HTMLElement;
  private readonly bestValue: HTMLElement;
  private readonly lastRunValue: HTMLElement;
  private readonly actionSuffix: HTMLElement;
  private readonly volumeInputs: readonly HTMLInputElement[];

  constructor(
    parent: HTMLElement,
    initialSfxVolume: number,
    initialMusicVolume: number,
    onVolumeChange: (channel: "sfx" | "music", volume: number) => void,
  ) {
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
          <div><dt>CONTROL</dt><dd>WASD / ARROWS · ESC TO EXIT</dd></div>
          <div><dt>FAIL STATE</dt><dd>ONE HIT</dd></div>
          <div><dt>LAST RUN</dt><dd data-ready-last-run>--:--.-- / NO RUN YET</dd></div>
          <div><dt>SESSION BEST</dt><dd data-ready-best>00:00.00</dd></div>
        </dl>

        <div class="ready-action">
          <span class="ready-action__prompt" aria-hidden="true">›</span>
          <strong>CLICK OR PRESS SPACE</strong>
          <span data-ready-action-suffix>TO START RUN</span>
        </div>

        <div class="ready-volumes" aria-label="Audio volume controls">
          <label class="ready-volume">
            <span>SFX VOLUME</span>
            <input
              id="await-codex-sfx-volume"
              type="range"
              min="0"
              max="100"
              step="5"
              value="${Math.round(initialSfxVolume * 100)}"
              aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight A D"
            />
            <output for="await-codex-sfx-volume" data-ready-sfx-volume-output>${Math.round(initialSfxVolume * 100)}%</output>
          </label>
          <label class="ready-volume">
            <span>BGM VOLUME</span>
            <input
              id="await-codex-music-volume"
              type="range"
              min="0"
              max="100"
              step="5"
              value="${Math.round(initialMusicVolume * 100)}"
              aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight A D"
            />
            <output for="await-codex-music-volume" data-ready-music-volume-output>${Math.round(initialMusicVolume * 100)}%</output>
          </label>
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
    const sfxVolumeInput = this.root.querySelector<HTMLInputElement>(
      "#await-codex-sfx-volume",
    );
    const sfxVolumeOutput = this.root.querySelector<HTMLOutputElement>(
      "[data-ready-sfx-volume-output]",
    );
    const musicVolumeInput = this.root.querySelector<HTMLInputElement>(
      "#await-codex-music-volume",
    );
    const musicVolumeOutput = this.root.querySelector<HTMLOutputElement>(
      "[data-ready-music-volume-output]",
    );
    if (
      !bestValue ||
      !lastRunValue ||
      !actionSuffix ||
      !sfxVolumeInput ||
      !sfxVolumeOutput ||
      !musicVolumeInput ||
      !musicVolumeOutput
    ) {
      throw new Error("Ready overlay status targets were not found.");
    }

    const bindVolumeControl = (
      channel: "sfx" | "music",
      input: HTMLInputElement,
      output: HTMLOutputElement,
    ): void => {
      const commitVolume = (): void => {
        const volume = Number(input.value) / 100;
        output.textContent = `${input.value}%`;
        onVolumeChange(channel, volume);
      };

      input.addEventListener("input", commitVolume);
      input.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
      });
      input.addEventListener("keydown", (event) => {
        event.stopPropagation();
        const focusDirection = volumeFocusDirection(event.key);
        if (focusDirection !== 0) {
          event.preventDefault();
          if (focusDirection < 0) {
            sfxVolumeInput.focus();
          } else {
            musicVolumeInput.focus();
          }
          return;
        }
        const direction = volumeStepDirection(event.key);
        if (direction === 0) {
          return;
        }
        event.preventDefault();
        if (direction < 0) {
          input.stepDown();
        } else {
          input.stepUp();
        }
        commitVolume();
      });
      input.addEventListener("keyup", (event) => {
        event.stopPropagation();
      });
    };

    bindVolumeControl("sfx", sfxVolumeInput, sfxVolumeOutput);
    bindVolumeControl("music", musicVolumeInput, musicVolumeOutput);
    this.volumeInputs = [sfxVolumeInput, musicVolumeInput];

    this.bestValue = bestValue;
    this.lastRunValue = lastRunValue;
    this.actionSuffix = actionSuffix;
    parent.append(this.root);
    this.createAmbientSignals();
  }

  render(state: GameState, localBest: number): void {
    const view = startScreenView(state, localBest);
    this.root.hidden = !view.visible;
    if (!view.visible) {
      for (const input of this.volumeInputs) {
        input.blur();
      }
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

      element.style.visibility = "hidden";
      layer.append(element);
      this.applyAmbientPath(element, true);
      element.style.visibility = "";
      element.addEventListener("animationiteration", () => {
        this.applyAmbientPath(element, false);
      });
    }
  }

  private applyAmbientPath(element: HTMLElement, initial: boolean): void {
    const bounds = element.getBoundingClientRect();
    const path = createAmbientPath(
      Math.random,
      Math.max(1, window.innerWidth),
      Math.max(1, window.innerHeight),
      Math.hypot(bounds.width, bounds.height),
    );
    element.style.setProperty("--ready-start-x", `${path.startX}px`);
    element.style.setProperty("--ready-start-y", `${path.startY}px`);
    element.style.setProperty("--ready-end-x", `${path.endX}px`);
    element.style.setProperty("--ready-end-y", `${path.endY}px`);
    element.style.setProperty("--ready-angle", `${path.angleDeg}deg`);
    element.style.animationDuration = `${path.durationSeconds}s`;
    element.style.animationDelay = initial ? `${path.delaySeconds}s` : "0s";
  }
}
