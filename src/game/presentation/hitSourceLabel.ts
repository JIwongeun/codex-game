import type { HitSource } from "../core/model";

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

export function hitSourceLabel(source: HitSource | null): string {
  return source ? HIT_SOURCE_LABEL[source] : "UNKNOWN INTERRUPTION";
}
