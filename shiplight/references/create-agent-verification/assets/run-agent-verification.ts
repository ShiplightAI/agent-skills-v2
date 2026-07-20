#!/usr/bin/env tsx

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline';

import type { CaseTiming, ToolTiming } from './agent-verification-types';

type AgentStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'ABORTED';

type SuiteCase = {
  id: string;
  case: string;
  required: boolean;
  timeout_minutes: number;
};

type Args = {
  target?: string;
  suite?: string;
  casePath?: string;
  caseId?: string;
  caseRequired?: boolean;
  caseTimeoutMinutes?: number;
  engines: string[];
  engineCommandTemplate?: string;
  reportDir: string;
  dryRun: boolean;
  engineRetries: number;
};

// Timing-profile shapes (ToolTiming, CaseTiming) live in ./agent-verification-types
// so the runner and aggregator share one definition.

type CaseResult = {
  id: string;
  casePath: string;
  required: boolean;
  status: AgentStatus | 'MISSING_REPORT' | 'MISSING_STATUS' | 'ENGINE_FAILED' | 'TIMED_OUT';
  reportPath: string;
  exitCode: number | null;
  attempts: number;
  // Engine that produced the terminal result (after any cross-engine fallback).
  engine?: string;
  timing?: CaseTiming;
};

const allowedTargets = new Set(['local', 'staging', 'production']);
const manifestPath = 'tests/agent/agent-test-suites.json';

// Monotonic per-run counter so each engine attempt (retry or fallback) gets a
// distinct report path. timestamp() is only second-granular, so without this two
// attempts in the same second would share a file — and fs.existsSync could read a
// crashed engine's stale report and misattribute it to the next engine.
let runAttemptSeq = 0;

function usage(): never {
  console.error(`Usage:
  pnpm agent:verify --target <local|staging|production> --suite <suite-name> [--engine codex]
  pnpm agent:verify --target <local|staging|production> --case <case.md> [--engine codex]

Options:
  --engine <codex|claude|command>             Agent CLI to execute, or a comma-separated
                                              fallback chain (e.g. claude,codex) tried
                                              left-to-right on engine crash. Default: codex
  --case-id <id>                              Required when a workflow runs one manifest case
  --required <true|false>                     Required flag for a single manifest case
  --timeout-minutes <minutes>                 Timeout for a single manifest case
  --engine-command-template <shell command>   Test hook; receives AGENT_VERIFICATION_* env vars
  --report-dir <dir>                          Default: agent-test-reports
  --engine-retries <n>                        Re-run a case on engine crash (ENGINE_FAILED). Default: 1
  --dry-run                                   Print the selected cases without invoking an agent`);
  process.exit(2);
}

function parseBoolean(value: string): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  console.error(`Expected true or false, got: ${value}`);
  usage();
}

function parsePositiveNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.error(`Expected a positive number, got: ${value}`);
    usage();
  }
  return parsed;
}

function parseNonNegativeInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    console.error(`Expected a non-negative integer, got: ${value}`);
    usage();
  }
  return parsed;
}

// A single engine or a comma-separated fallback chain (claude,codex).
// Trims, drops empties, and dedupes while preserving order.
function parseEngines(value: string): string[] {
  const engines: string[] = [];
  for (const part of value.split(',')) {
    const engine = part.trim();
    if (engine && !engines.includes(engine)) engines.push(engine);
  }
  if (engines.length === 0) {
    console.error(`--engine requires at least one engine, got: ${value}`);
    usage();
  }
  return engines;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    target: process.env.AGENT_VERIFICATION_TARGET,
    caseId: process.env.AGENT_VERIFICATION_CASE_ID,
    caseRequired: process.env.AGENT_VERIFICATION_CASE_REQUIRED
      ? parseBoolean(process.env.AGENT_VERIFICATION_CASE_REQUIRED)
      : undefined,
    caseTimeoutMinutes: process.env.AGENT_VERIFICATION_TIMEOUT_MINUTES
      ? parsePositiveNumber(process.env.AGENT_VERIFICATION_TIMEOUT_MINUTES)
      : undefined,
    engines: parseEngines(process.env.AGENT_VERIFICATION_ENGINE ?? 'codex'),
    reportDir: process.env.AGENT_VERIFICATION_REPORT_DIR ?? 'agent-test-reports',
    dryRun: false,
    engineRetries: process.env.AGENT_VERIFICATION_ENGINE_RETRIES
      ? parseNonNegativeInteger(process.env.AGENT_VERIFICATION_ENGINE_RETRIES)
      : 1,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) usage();
      index += 1;
      return value;
    };

    switch (arg) {
      case '--target':
        args.target = next();
        break;
      case '--suite':
        args.suite = next();
        break;
      case '--case':
        args.casePath = next();
        break;
      case '--case-id':
        args.caseId = next();
        break;
      case '--required':
        args.caseRequired = parseBoolean(next());
        break;
      case '--timeout-minutes':
        args.caseTimeoutMinutes = parsePositiveNumber(next());
        break;
      case '--engine':
        args.engines = parseEngines(next());
        break;
      case '--engine-command-template':
        args.engineCommandTemplate = next();
        break;
      case '--report-dir':
        args.reportDir = next();
        break;
      case '--engine-retries':
        args.engineRetries = parseNonNegativeInteger(next());
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--help':
      case '-h':
        usage();
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        usage();
    }
  }

  if (!args.target || !allowedTargets.has(args.target)) {
    console.error('Agent verification requires --target local, staging, or production.');
    usage();
  }
  if (!args.suite && !args.casePath) {
    console.error('Agent verification requires --suite or --case.');
    usage();
  }
  if (args.suite && args.casePath) {
    console.error('Use either --suite or --case, not both.');
    usage();
  }
  if (
    !args.casePath &&
    (args.caseId || args.caseRequired !== undefined || args.caseTimeoutMinutes)
  ) {
    console.error('--case-id, --required, and --timeout-minutes require --case.');
    usage();
  }
  if (args.engineCommandTemplate && args.target !== 'local') {
    console.error('--engine-command-template is only allowed with --target local.');
    usage();
  }

  return args;
}

function readSuites(): Record<string, SuiteCase[]> {
  const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${manifestPath} must contain an object of suite names to cases.`);
  }

  const suites: Record<string, SuiteCase[]> = {};
  for (const [suiteName, value] of Object.entries(raw)) {
    if (!Array.isArray(value)) {
      throw new Error(`Suite ${suiteName} must be an array.`);
    }
    suites[suiteName] = value.map((item, index) => normalizeSuiteCase(suiteName, item, index));
  }
  return suites;
}

function normalizeSuiteCase(suiteName: string, item: unknown, index: number): SuiteCase {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error(`Suite ${suiteName} case ${index} must be an object.`);
  }
  const record = item as Record<string, unknown>;
  if (typeof record.id !== 'string' || record.id.length === 0) {
    throw new Error(`Suite ${suiteName} case ${index} is missing id.`);
  }
  const id = slugify(record.id);
  if (!id) {
    throw new Error(`Suite ${suiteName} case ${index} has an invalid id.`);
  }
  if (typeof record.case !== 'string' || record.case.length === 0) {
    throw new Error(`Suite ${suiteName} case ${id} is missing case path.`);
  }
  return {
    id,
    case: record.case,
    required: typeof record.required === 'boolean' ? record.required : true,
    timeout_minutes:
      typeof record.timeout_minutes === 'number' && record.timeout_minutes > 0
        ? record.timeout_minutes
        : 30,
  };
}

function selectedCases(args: Args): SuiteCase[] {
  if (args.casePath) {
    return [
      {
        id: slugify(args.caseId ?? path.basename(args.casePath, path.extname(args.casePath))),
        case: args.casePath,
        required: args.caseRequired ?? true,
        timeout_minutes: args.caseTimeoutMinutes ?? 30,
      },
    ];
  }

  const suites = readSuites();
  const suite = suites[args.suite ?? ''];
  if (!suite) {
    throw new Error(`Unknown agent verification suite: ${args.suite}`);
  }
  return suite;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function timestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function commandExists(command: string): boolean {
  const result = spawnSync('bash', ['-c', `command -v ${shellQuote(command)}`], {
    encoding: 'utf8',
  });
  return result.status === 0;
}

function parseStatus(report: string): AgentStatus | undefined {
  const match = report.match(
    /^(?:[-*]\s+)?(?:\*\*)?Status:\s*(PASS|FAIL|BLOCKED|ABORTED)\s*(?:\*\*)?\s*$/m,
  );
  return match?.[1] as AgentStatus | undefined;
}

function buildPrompt(params: {
  target: string;
  caseId: string;
  casePath: string;
  reportPath: string;
  caseMarkdown: string;
}): string {
  return `You are executing a Shiplight agent test.

Target environment: ${params.target}
Agent test id: ${params.caseId}
Agent test file: ${params.casePath}

Write the final verification report to this exact path:
${params.reportPath}

The report must include one final exact status line:
Status: PASS
Status: FAIL
or
Status: BLOCKED

Use Status: BLOCKED only when environment, access, credentials, fixtures, or app
startup prevent product verification from starting. Once product verification
starts, return Status: PASS or Status: FAIL.

Execute the case below exactly.

${params.caseMarkdown}
`;
}

/**
 * Prepare a hybrid case's embedded Shiplight UI project (`<case-dir>/ui`) so the
 * agent can run `npx shiplight test` against it. Self-contained here — not in the
 * CI workflow — so it works identically for local, CI, and staging runs, and so a
 * fresh checkout can run a hybrid case without manual setup. A no-op for
 * backend-only cases (no `ui/`). Idempotent: skips the dependency install when
 * `node_modules` is already present, and Playwright's browser install
 * short-circuits once the machine-global cache exists.
 *
 * A setup failure is an expected, per-case blocker — signal it with
 * `{ ok: false, reason }` so the caller records this one case BLOCKED, rather than
 * throwing (which would abort the whole run and skip sibling cases + the summary).
 */
// Bounds a hung npm/Playwright install so a stalled network can't freeze a CI job
// indefinitely (the case-level timeout only wraps the engine subprocess, not setup).
const UI_SETUP_TIMEOUT_MS = 10 * 60 * 1000;

// spawnSync sets status=null (+ error ETIMEDOUT) on timeout; describe both cleanly.
function describeSpawnFailure(r: ReturnType<typeof spawnSync>): string {
  if ((r.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT') {
    return `timed out after ${UI_SETUP_TIMEOUT_MS / 60_000}m`;
  }
  return `exit ${r.status}`;
}

function ensureCaseUiSetup(casePath: string): { ok: true } | { ok: false; reason: string } {
  const uiDir = path.join(path.dirname(casePath), 'ui');
  if (!fs.existsSync(path.join(uiDir, 'package.json'))) return { ok: true }; // backend-only case
  const opts = { cwd: uiDir, stdio: 'inherit', timeout: UI_SETUP_TIMEOUT_MS } as const;

  if (!fs.existsSync(path.join(uiDir, 'node_modules'))) {
    console.log(`[ui-setup] installing dependencies in ${uiDir}`);
    // `npm ci` is reproducible but hard-fails on any lockfile/package.json drift;
    // fall back to `npm install` so a scaffold quirk can't block the whole run.
    let install = spawnSync('npm', ['ci'], opts);
    if (install.status !== 0) {
      console.warn(`[ui-setup] npm ci failed in ${uiDir}; retrying with npm install`);
      install = spawnSync('npm', ['install'], opts);
    }
    if (install.status !== 0) {
      return { ok: false, reason: `dependency install failed in ${uiDir} (${describeSpawnFailure(install)})` };
    }
  }

  console.log(`[ui-setup] ensuring Playwright chromium for ${uiDir}`);
  const browser = spawnSync('npx', ['playwright', 'install', 'chromium'], opts);
  if (browser.status !== 0) {
    return { ok: false, reason: `playwright install failed in ${uiDir} (${describeSpawnFailure(browser)})` };
  }
  return { ok: true };
}

/**
 * Per-target base URLs + provisioning defaults, injected into the agent + YAML env so
 * cases and `ui/` tests stay environment-agnostic — they read `$WEB_URL` / `$ADMIN_URL` /
 * `$E2E_PROVISIONING_URL` / `$E2E_PROVISIONING_TOKEN` instead of hardcoding localhost.
 * `process.env` overrides these, so the staging prep script's secrets
 * (`E2E_PROVISIONING_TOKEN`, `DATABASE_URL`) win over the defaults here.
 */
function targetEnvDefaults(target: string): Record<string, string> {
  const staging = target === 'staging';
  const web = staging ? 'https://nova-staging.shiplight.ai' : 'http://localhost:3456';
  const admin = staging ? 'https://nova-admin-staging.shiplight.ai' : 'http://localhost:3457';
  const defaults: Record<string, string> = {
    WEB_URL: web,
    ADMIN_URL: admin,
    E2E_PROVISIONING_URL: web,
    ADMIN_E2E_PROVISIONING_URL: admin,
  };
  // The local broker token is a fixed dev value; staging's comes from the prep script.
  if (!staging) defaults.E2E_PROVISIONING_TOKEN = 'local-dev-e2e-token';
  return defaults;
}

async function runCase(args: Args, suiteCase: SuiteCase): Promise<CaseResult> {
  // Self-contained per-case setup for hybrid cases (no-op for backend-only ones):
  // ensure the case's embedded Shiplight UI project is installed before the engine
  // runs. Once per case (not per engine attempt), so retries don't reinstall. A
  // setup failure blocks just this case, so sibling cases still run.
  const uiSetup = ensureCaseUiSetup(suiteCase.case);
  if (!uiSetup.ok) {
    console.error(`${suiteCase.id}: UI setup failed — ${uiSetup.reason}`);
    return {
      id: suiteCase.id,
      casePath: suiteCase.case,
      required: suiteCase.required,
      status: 'BLOCKED',
      reportPath: '',
      exitCode: null,
      attempts: 0,
    };
  }

  // The test-only shell template hook stays single-engine (local only); the
  // fallback chain applies to named engines.
  const chain = args.engineCommandTemplate ? ['custom-template'] : args.engines;

  let totalAttempts = 0;
  let lastResult: CaseResult | undefined;
  for (const [index, engine] of chain.entries()) {
    const { result, attempts } = await runEngineWithRetries(args, suiteCase, engine);
    totalAttempts += attempts;
    lastResult = result;

    // Only an engine crash is recoverable by another provider. A real verdict
    // (PASS/FAIL/ABORTED/BLOCKED), a missing/garbled report, or a timeout is
    // terminal — re-running it on a different engine would not be honest.
    if (result.status !== 'ENGINE_FAILED') {
      return { ...result, engine, attempts: totalAttempts };
    }

    const nextEngine = chain[index + 1];
    if (nextEngine) {
      console.log(
        `${suiteCase.id}: ${engine} engine failed (exit ${result.exitCode}); ` +
          `falling back to ${nextEngine}`,
      );
    }
  }

  const lastEngine = chain[chain.length - 1];
  return { ...(lastResult as CaseResult), engine: lastEngine, attempts: totalAttempts };
}

// Runs one engine with the configured same-engine retry budget. Returns the
// terminal result for this engine and how many attempts it consumed.
async function runEngineWithRetries(
  args: Args,
  suiteCase: SuiteCase,
  engine: string,
): Promise<{ result: CaseResult; attempts: number }> {
  const maxAttempts = args.engineRetries + 1;
  let result = await runCaseOnce(args, suiteCase, engine);
  let attempt = 1;
  while (result.status === 'ENGINE_FAILED' && attempt < maxAttempts) {
    console.log(
      `${suiteCase.id}: ${engine} engine crashed (exit ${result.exitCode}); ` +
        `retrying attempt ${attempt + 1}/${maxAttempts}`,
    );
    result = await runCaseOnce(args, suiteCase, engine);
    attempt += 1;
  }
  return { result, attempts: attempt };
}

async function runCaseOnce(args: Args, suiteCase: SuiteCase, engine: string): Promise<CaseResult> {
  if (!fs.existsSync(suiteCase.case)) {
    throw new Error(`Agent test does not exist: ${suiteCase.case}`);
  }

  fs.mkdirSync(args.reportDir, { recursive: true });
  runAttemptSeq += 1;
  const reportPath = path.join(
    args.reportDir,
    `${suiteCase.id}-${args.target}-${timestamp()}-${String(runAttemptSeq).padStart(3, '0')}.md`,
  );
  const absoluteReportPath = path.resolve(reportPath);
  const promptPath = path.join(
    os.tmpdir(),
    `${suiteCase.id}-${process.pid}-${Date.now()}.prompt.md`,
  );
  const caseMarkdown = fs.readFileSync(suiteCase.case, 'utf8');
  const prompt = buildPrompt({
    target: args.target ?? '',
    caseId: suiteCase.id,
    casePath: suiteCase.case,
    reportPath: absoluteReportPath,
    caseMarkdown,
  });
  fs.writeFileSync(promptPath, prompt);

  const timeoutMs = suiteCase.timeout_minutes * 60 * 1000;
  const env = {
    ...targetEnvDefaults(args.target ?? ''),
    ...process.env,
    AGENT_VERIFICATION_TARGET: args.target ?? '',
    AGENT_VERIFICATION_CASE_ID: suiteCase.id,
    AGENT_VERIFICATION_CASE_PATH: path.resolve(suiteCase.case),
    AGENT_VERIFICATION_REPORT_PATH: absoluteReportPath,
    AGENT_VERIFICATION_PROMPT_PATH: promptPath,
  };

  const engineLabel = args.engineCommandTemplate ? 'custom-template' : path.basename(engine);
  const startedAt = Date.now();
  let exitStatus: number | null;
  let timedOut: boolean;
  let processTiming: Partial<CaseTiming> | undefined;
  try {
    if (args.engineCommandTemplate) {
      // Test-only escape hatch for contract tests and local harness experiments.
      // Release workflows should use named engines, not shell templates.
      const result = spawnSync(
        args.engineCommandTemplate
          .replaceAll('{{prompt_file}}', shellQuote(promptPath))
          .replaceAll('{{report_path}}', shellQuote(absoluteReportPath))
          .replaceAll('{{case_path}}', shellQuote(path.resolve(suiteCase.case))),
        {
          shell: true,
          stdio: 'inherit',
          timeout: timeoutMs,
          env,
        },
      );
      exitStatus = result.status;
      timedOut = (result.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT';
    } else {
      const outcome = await runEngineProcess(
        engine,
        engineInvocation(engine, { prompt, timeoutMinutes: suiteCase.timeout_minutes }),
        { timeoutMs, env, reportPath },
      );
      exitStatus = outcome.status;
      timedOut = outcome.timedOut;
      processTiming = outcome.timing;
    }
  } finally {
    fs.rmSync(promptPath, { force: true });
  }

  // Wall-clock is engine-agnostic; the richer breakdown (tools/llm) rides along
  // only when the engine emitted a stream-json trace we could parse (claude).
  const timing: CaseTiming = { engine: engineLabel, wallMs: Date.now() - startedAt, ...processTiming };

  if (exitStatus !== 0) {
    return {
      id: suiteCase.id,
      casePath: suiteCase.case,
      required: suiteCase.required,
      status: timedOut ? 'TIMED_OUT' : 'ENGINE_FAILED',
      reportPath,
      exitCode: exitStatus,
      attempts: 1,
      timing,
    };
  }

  if (!fs.existsSync(reportPath)) {
    return {
      id: suiteCase.id,
      casePath: suiteCase.case,
      required: suiteCase.required,
      status: 'MISSING_REPORT',
      reportPath,
      exitCode: exitStatus,
      attempts: 1,
      timing,
    };
  }

  const status = parseStatus(fs.readFileSync(reportPath, 'utf8'));
  return {
    id: suiteCase.id,
    casePath: suiteCase.case,
    required: suiteCase.required,
    status: status ?? 'MISSING_STATUS',
    reportPath,
    exitCode: exitStatus,
    attempts: 1,
    timing,
  };
}

type EngineInvocation = { args: string[]; input?: string };

// argv (and whether the prompt goes on stdin) for each named engine.
function engineInvocation(
  engine: string,
  ctx: { prompt: string; timeoutMinutes: number },
): EngineInvocation {
  switch (path.basename(engine)) {
    case 'codex':
      // `danger-full-access` is the documented sandbox mode for isolated CI
      // runners; it lets codex exec drive the DB/network/MCP work the cases
      // need (the analogue of claude's bypassPermissions). `-` reads the prompt
      // from stdin.
      return { args: ['exec', '--sandbox', 'danger-full-access', '-'], input: ctx.prompt };
    case 'claude':
      return {
        args: [
          '--print',
          '--output-format',
          'stream-json',
          '--include-partial-messages',
          '--include-hook-events',
          '--verbose',
          '--permission-mode',
          'bypassPermissions',
          '--mcp-config',
          '.github/agent-verification-mcp.json',
        ],
        input: ctx.prompt,
      };
    default:
      console.warn(
        `Unknown agent verification engine "${engine}"; invoking it with stdin and no extra arguments.`,
      );
      return { args: [], input: ctx.prompt };
  }
}

// Coarse "where did the time go" bucket for a tool, by tool name.
function categorizeTool(name: string): string {
  if (name.startsWith('mcp__')) return 'mcp'; // shiplight MCP — browser/DB automation
  if (name === 'Bash') return 'shell';
  if (['Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Glob', 'Grep', 'LS'].includes(name)) {
    return 'file';
  }
  return 'other';
}

type ProcessOutcome = { status: number | null; timedOut: boolean; timing?: Partial<CaseTiming> };

// Spawns a named engine, piping the prompt on stdin when the invocation uses it,
// and enforcing the case timeout with a SIGKILL. For claude (the only engine
// that emits a machine-readable stream-json trace) it also tees stdout to a
// `.stream.jsonl` sidecar and times each tool call by stamping line arrivals,
// producing the per-step timing breakdown.
function runEngineProcess(
  engine: string,
  invocation: EngineInvocation,
  ctx: { timeoutMs: number; env: NodeJS.ProcessEnv; reportPath: string },
): Promise<ProcessOutcome> {
  const profile = path.basename(engine) === 'claude';
  const streamPath = profile ? ctx.reportPath.replace(/\.md$/, '.stream.jsonl') : undefined;
  // Buffered (async) write stream rather than a synchronous writeSync per line:
  // claude runs with --include-partial-messages, so the trace is a high-rate
  // flood of token-delta lines, and a blocking syscall on each one would sit on
  // the readline hot path and inflate the very wallMs the profiler measures.
  const streamFile = streamPath ? fs.createWriteStream(streamPath) : undefined;
  // A trace-write error must never crash the run, but surface it so a full disk
  // or bad path doesn't yield a silently-missing .stream.jsonl.
  streamFile?.on('error', (err) =>
    console.warn(`agent verification: failed writing ${streamPath}: ${err.message}`),
  );

  // Tool spans keyed by tool_use id, aggregated per tool name. Result-event
  // fields (whole-case wall/api time) come from claude's final summary line.
  const toolStarts = new Map<string, { name: string; startedAt: number }>();
  const toolAgg = new Map<string, ToolTiming>();
  const resultEvent: Pick<CaseTiming, 'reportedWallMs' | 'apiMs' | 'numTurns' | 'costUsd'> = {};

  const onLine = (line: string) => {
    streamFile?.write(`${line}\n`);
    // Preserve the prior behaviour of surfacing claude's stream to CI logs.
    process.stdout.write(`${line}\n`);
    const now = Date.now();
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      return; // non-JSON progress line; nothing to time
    }
    if (!event || typeof event !== 'object') return;
    const record = event as { type?: unknown; message?: { content?: unknown } };
    const content = Array.isArray(record.message?.content) ? record.message?.content : [];
    if (record.type === 'assistant') {
      for (const block of content as Array<Record<string, unknown>>) {
        if (block?.type === 'tool_use' && typeof block.id === 'string') {
          toolStarts.set(block.id, { name: String(block.name ?? 'unknown'), startedAt: now });
        }
      }
    } else if (record.type === 'user') {
      for (const block of content as Array<Record<string, unknown>>) {
        if (block?.type === 'tool_result' && typeof block.tool_use_id === 'string') {
          const start = toolStarts.get(block.tool_use_id);
          if (!start) continue;
          toolStarts.delete(block.tool_use_id);
          const agg = toolAgg.get(start.name) ?? {
            name: start.name,
            category: categorizeTool(start.name),
            count: 0,
            totalMs: 0,
          };
          agg.count += 1;
          agg.totalMs += Math.max(0, now - start.startedAt);
          toolAgg.set(start.name, agg);
        }
      }
    } else if (record.type === 'result') {
      const r = event as Record<string, unknown>;
      if (typeof r.duration_ms === 'number') resultEvent.reportedWallMs = r.duration_ms;
      if (typeof r.duration_api_ms === 'number') resultEvent.apiMs = r.duration_api_ms;
      if (typeof r.num_turns === 'number') resultEvent.numTurns = r.num_turns;
      if (typeof r.total_cost_usd === 'number') resultEvent.costUsd = r.total_cost_usd;
    }
  };

  return new Promise<ProcessOutcome>((resolve) => {
    const child = spawn(engine, invocation.args, {
      stdio: [invocation.input === undefined ? 'ignore' : 'pipe', profile ? 'pipe' : 'inherit', 'inherit'],
      env: ctx.env,
    });

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, ctx.timeoutMs);

    if (invocation.input !== undefined && child.stdin) {
      child.stdin.on('error', () => {}); // swallow EPIPE if the engine exits early
      child.stdin.write(invocation.input);
      child.stdin.end();
    }

    let rl: readline.Interface | undefined;
    if (profile && child.stdout) {
      rl = readline.createInterface({ input: child.stdout });
      rl.on('line', onLine);
    }

    // Resolve only once both the process has exited and the stream has fully
    // drained, so a trailing tool_result/result line is not lost to a race.
    let exitStatus: number | null = null;
    let processClosed = false;
    let streamClosed = !rl;
    let settled = false;
    const maybeFinish = () => {
      if (settled || !processClosed || !streamClosed) return;
      settled = true;
      clearTimeout(timer);
      const outcome: ProcessOutcome = { status: exitStatus, timedOut };
      if (profile) {
        // Note: a SIGKILL'd (timed-out) run can leave an in-flight tool_use with
        // no matching tool_result; that span stays in toolStarts unmatched, so
        // toolTotalMs undercounts for timed-out cases. Acceptable — the profile
        // is a guide for perf work, and timed-out runs are flagged TIMED_OUT.
        const tools = [...toolAgg.values()].sort((a, b) => b.totalMs - a.totalMs);
        const toolTotalMs = tools.reduce((sum, t) => sum + t.totalMs, 0);
        const byCategoryMs: Record<string, number> = {};
        for (const t of tools) byCategoryMs[t.category] = (byCategoryMs[t.category] ?? 0) + t.totalMs;
        if (resultEvent.apiMs !== undefined) byCategoryMs.llm = resultEvent.apiMs;
        outcome.timing = { ...resultEvent, tools, toolTotalMs, byCategoryMs, streamPath };
      }
      // Flush the buffered trace before resolving so the sidecar is complete by
      // the time the caller reads it.
      if (streamFile) {
        streamFile.end(() => resolve(outcome));
      } else {
        resolve(outcome);
      }
    };

    rl?.on('close', () => {
      streamClosed = true;
      maybeFinish();
    });
    child.on('error', () => {
      // Spawn failure: no exit code, nothing more to drain.
      exitStatus = null;
      processClosed = true;
      streamClosed = true;
      maybeFinish();
    });
    child.on('close', (code) => {
      exitStatus = code;
      processClosed = true;
      maybeFinish();
    });
  });
}

function writeSummary(args: Args, results: CaseResult[]) {
  fs.mkdirSync(args.reportDir, { recursive: true });
  const suiteOrCase = args.suite ?? slugify(path.basename(args.casePath ?? 'case', '.md'));
  const summaryPath = path.join(
    args.reportDir,
    `agent-verification-summary-${suiteOrCase}-${args.target}-${timestamp()}.json`,
  );
  fs.writeFileSync(
    summaryPath,
    `${JSON.stringify(
      {
        target: args.target,
        suite: args.suite,
        case: args.casePath,
        engine: args.engineCommandTemplate ? 'custom-template' : args.engines.join(','),
        results,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Wrote summary: ${summaryPath}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cases = selectedCases(args);

  console.log(
    `Agent verification target=${args.target} suite=${args.suite ?? '<single-case>'} cases=${cases.length}`,
  );
  for (const suiteCase of cases) {
    console.log(`- ${suiteCase.id}: ${suiteCase.case}`);
  }

  if (args.dryRun || cases.length === 0) {
    return;
  }

  if (!args.engineCommandTemplate) {
    // Drop chain engines whose CLI is not installed so a missing fallback does
    // not abort the run; only hard-fail if nothing in the chain is available.
    const present = args.engines.filter((engine) => commandExists(engine));
    for (const engine of args.engines.filter((engine) => !present.includes(engine))) {
      console.warn(`Agent verification engine not found on PATH, skipping: ${engine}`);
    }
    if (present.length === 0) {
      throw new Error(`No agent verification engine found on PATH: ${args.engines.join(', ')}`);
    }
    args.engines = present;
  }

  // Cases run sequentially (CI fans out one case per matrix job); each engine
  // subprocess is awaited so the stream-json timing capture completes in order.
  const results: CaseResult[] = [];
  for (const suiteCase of cases) {
    results.push(await runCase(args, suiteCase));
  }
  writeSummary(args, results);

  let failed = false;
  for (const result of results) {
    const attemptNote = result.attempts > 1 ? ` after ${result.attempts} attempts` : '';
    const engineNote = result.engine && result.engine !== 'custom-template' ? ` via ${result.engine}` : '';
    console.log(`${result.id}: ${result.status}${attemptNote}${engineNote} (${result.reportPath})`);
    if (result.required && result.status !== 'PASS') {
      failed = true;
    }
  }
  if (failed) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
