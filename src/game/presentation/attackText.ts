import type { AttackSurface } from "../core/model";
import { ATTACK_TEXT_COLORS } from "./theme";

export type AttackTextRole = keyof typeof ATTACK_TEXT_COLORS;

export interface AttackTextToken {
  text: string;
  role: AttackTextRole;
}

export interface AttackTextLayout {
  offsets: number[];
  totalWidth: number;
}

const TERMINAL_EXECUTABLES = new Set([
  "cat",
  "cd",
  "cp",
  "curl",
  "docker",
  "eslint",
  "find",
  "get-childitem",
  "get-content",
  "get-location",
  "git",
  "gh",
  "grep",
  "head",
  "ls",
  "mkdir",
  "mv",
  "npm",
  "npx",
  "node",
  "pnpm",
  "prettier",
  "pwd",
  "rg",
  "rm",
  "sed",
  "select-string",
  "tail",
  "test-path",
  "touch",
  "tsc",
  "vite",
  "vitest",
  "wc",
  "yarn",
]);

const TOKEN_PATTERN = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\s+|[^\s]+)/g;

export function attackTextTokens(
  surface: AttackSurface,
  label: string,
): AttackTextToken[] {
  if (surface === "terminal") {
    return terminalTokens(label);
  }
  if (surface === "browser") {
    return browserTokens(label);
  }
  return codexTokens(label);
}

export function attackTextColor(role: AttackTextRole): string {
  return ATTACK_TEXT_COLORS[role];
}

export function layoutAttackTextTokens(
  surface: AttackSurface,
  tokens: readonly AttackTextToken[],
  widths: readonly number[],
  strokeThickness: number,
): AttackTextLayout {
  const promptStrokeOverlap =
    surface === "terminal" && /^\$\s+$/.test(tokens[0]?.text ?? "")
      ? strokeThickness * 2
      : 0;
  const totalWidth =
    widths.reduce((width, pieceWidth) => width + pieceWidth, 0) -
    promptStrokeOverlap;
  const offsets: number[] = [];
  let cursorX = -totalWidth / 2;

  for (let index = 0; index < widths.length; index += 1) {
    offsets.push(cursorX);
    cursorX += widths[index] ?? 0;
    if (index === 0) {
      cursorX -= promptStrokeOverlap;
    }
  }

  return { offsets, totalWidth };
}

function terminalTokens(label: string): AttackTextToken[] {
  const parts = label.match(TOKEN_PATTERN) ?? [label];
  let executableFound = false;

  const tokens = parts.map((text) => {
    const lower = text.toLowerCase();
    const normalized = lower.replace(/:$/, "");

    if (/^\s+$/.test(text)) {
      return token(text, "ink");
    }
    if (text === "$") {
      return token(text, "muted");
    }
    if (/^(".*"|'.*')$/.test(text)) {
      return token(text, "terminalString");
    }
    if (!executableFound && TERMINAL_EXECUTABLES.has(normalized)) {
      executableFound = true;
      return token(text, "terminalExecutable");
    }
    if (/^--?[a-z][\w-]*(?:=.*)?$/i.test(text)) {
      return token(text, "terminalParameter");
    }
    if (/^warning$/i.test(normalized)) {
      return token(text, "terminalWarning");
    }
    if (/^(error|failed|bug!|ts\d+|enoent)$/i.test(normalized)) {
      return token(text, "terminalError");
    }
    return token(text, "ink");
  });

  if (tokens[0]?.text === "$" && /^\s+$/.test(tokens[1]?.text ?? "")) {
    tokens[0] = token(`$${tokens[1]?.text}`, "muted");
    tokens.splice(1, 1);
  }
  return tokens;
}

function browserTokens(label: string): AttackTextToken[] {
  if (label.startsWith("net::")) {
    return [
      token("net::", "browserMeta"),
      token(label.slice(5), "browserError"),
    ];
  }

  return (label.match(TOKEN_PATTERN) ?? [label]).map((text) => {
    if (/^\s+$/.test(text)) {
      return token(text, "ink");
    }
    if (/^\[(download|access)\]$/i.test(text) || /^\d+%$/.test(text)) {
      return token(text, "browserMeta");
    }
    if (/^ACCESS!$/i.test(text)) {
      return token(text, "browserError");
    }
    if (/^([45]\d{2}|ERR_[A-Z_]+|PAGE_[A-Z_]+)$/i.test(text)) {
      return token(text, "browserError");
    }
    if (/^\//.test(text)) {
      return token(text, "browserMeta");
    }
    return token(text, "ink");
  });
}

function codexTokens(label: string): AttackTextToken[] {
  const parts =
    label.match(/(\[[^\]]+\]|codex:|retry|\d+\/\d+|\d+%|\+|\s+|[^\s]+)/gi) ??
    [label];

  return parts.map((text) => {
    if (/^\s+$/.test(text)) {
      return token(text, "ink");
    }
    if (
      /^\[[^\]]+\]$/.test(text) ||
      /^(codex:|retry|\d+\/\d+|\d+%|\+)$/i.test(text)
    ) {
      return token(text, "codexToken");
    }
    return token(text, "ink");
  });
}

function token(text: string, role: AttackTextRole): AttackTextToken {
  return { text, role };
}
