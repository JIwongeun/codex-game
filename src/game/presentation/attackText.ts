import type { AttackSurface } from "../core/model";
import { ATTACK_TEXT_COLORS } from "./theme";

export type AttackTextRole = keyof typeof ATTACK_TEXT_COLORS;

export interface AttackTextToken {
  text: string;
  role: AttackTextRole;
}

const TERMINAL_EXECUTABLES = new Set([
  "cat",
  "git",
  "npm",
  "npx",
  "pnpm",
  "rg",
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

function terminalTokens(label: string): AttackTextToken[] {
  const parts = label.match(TOKEN_PATTERN) ?? [label];
  let executableFound = false;

  return parts.map((text) => {
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
    if (/^warning:?$/i.test(text)) {
      return token(text, "terminalWarning");
    }
    if (/^(error:?|failed|bug!|ts\d+)$/i.test(text)) {
      return token(text, "terminalError");
    }
    return token(text, "ink");
  });
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
    if (/^(404|ERR_[A-Z_]+|PAGE_[A-Z_]+)$/i.test(text)) {
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
