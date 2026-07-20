// Shared timing-profile shapes for the agent-verification scripts. The runner
// (run-agent-verification.ts) builds these from claude's stream-json trace; the
// aggregator (aggregate-agent-verification.ts) re-emits them verbatim into the
// merged suite summary. Defined in one place so the two scripts cannot drift.

// Per-tool execution timing, bucketed by the kind of work the tool does.
export type ToolTiming = { name: string; category: string; count: number; totalMs: number };

// Where a single case execution spent its time. wallMs is measured by the driver
// around the engine subprocess and is always present; the remaining fields come
// from parsing claude's stream-json trace and are absent for other engines.
export type CaseTiming = {
  engine: string;
  wallMs: number;
  // From claude's final `result` event: total run time and time spent in the
  // Anthropic API (i.e. LLM inference) for the whole case.
  reportedWallMs?: number;
  apiMs?: number;
  numTurns?: number;
  costUsd?: number;
  // Tool-execution time (tool_use → matching tool_result), per tool and summed.
  tools?: ToolTiming[];
  toolTotalMs?: number;
  // Rough where-did-time-go buckets in ms: tool categories plus `llm` (apiMs).
  byCategoryMs?: Record<string, number>;
  // Raw stream-json trace written alongside the report, for deeper analysis.
  streamPath?: string;
};
