#!/usr/bin/env tsx

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

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
  engine: string;
  engineCommandTemplate?: string;
  manifestPath: string;
  reportDir: string;
  allowedTargets: string[];
  projectName: string;
  claudeMcpConfig?: string;
  dryRun: boolean;
};

type CaseResult = {
  id: string;
  casePath: string;
  required: boolean;
  status:
    | AgentStatus
    | 'MISSING_REPORT'
    | 'MISSING_STATUS'
    | 'ENGINE_FAILED'
    | 'TIMED_OUT';
  reportPath: string;
  exitCode: number | null;
};

const DEFAULT_ALLOWED_TARGETS = ['local', 'staging', 'production'];
const DEFAULT_MANIFEST_PATH = 'tests/agent/agent-test-suites.json';
const DEFAULT_REPORT_DIR = 'agent-test-reports';
const DEFAULT_PROJECT_NAME = 'the project';
const DEFAULT_CLAUDE_MCP_CONFIG = '.github/agent-verification-mcp.json';

function usage(exitCode = 2): never {
  const write = exitCode === 0 ? console.log : console.error;
  write(`Usage:
  pnpm agent:verify --target <target> --suite <suite-name> [--engine codex]
  pnpm agent:verify --target <target> --case <case.md> [--engine codex]

Options:
  --target <target>                         Target environment. Default allowed: local, staging, production
  --suite <suite-name>                      Suite key from the manifest
  --case <case.md>                          Run one case file without reading a suite
  --case-id <id>                            Optional id for --case runs
  --required <true|false>                   Required flag for --case runs
  --timeout-minutes <minutes>               Timeout for --case runs
  --engine <codex|claude|gemini|command>    Agent CLI to execute. Default: codex
  --engine-command-template <shell command> Local test hook; receives AGENT_VERIFICATION_* env vars
  --manifest <path>                         Default: ${DEFAULT_MANIFEST_PATH}
  --report-dir <dir>                        Default: ${DEFAULT_REPORT_DIR}
  --allowed-targets <csv>                   Default: ${DEFAULT_ALLOWED_TARGETS.join(',')}
  --project-name <name>                     Product/project name used in agent prompts
  --claude-mcp-config <path>                Claude MCP config path. Default: ${DEFAULT_CLAUDE_MCP_CONFIG} when present
  --no-claude-mcp-config                    Invoke Claude without --mcp-config
  --dry-run                                 Print selected cases without invoking an agent

Environment equivalents:
  AGENT_VERIFICATION_TARGET
  AGENT_VERIFICATION_ENGINE
  AGENT_VERIFICATION_MANIFEST_PATH
  AGENT_VERIFICATION_REPORT_DIR
  AGENT_VERIFICATION_ALLOWED_TARGETS
  AGENT_VERIFICATION_PROJECT_NAME
  AGENT_VERIFICATION_CLAUDE_MCP_CONFIG`);
  process.exit(exitCode);
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : undefined;
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

function parseCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseArgs(argv: string[]): Args {
  const configuredClaudeMcpConfig = optionalEnv('AGENT_VERIFICATION_CLAUDE_MCP_CONFIG');
  const args: Args = {
    target: optionalEnv('AGENT_VERIFICATION_TARGET'),
    caseId: optionalEnv('AGENT_VERIFICATION_CASE_ID'),
    caseRequired: optionalEnv('AGENT_VERIFICATION_CASE_REQUIRED')
      ? parseBoolean(optionalEnv('AGENT_VERIFICATION_CASE_REQUIRED') ?? '')
      : undefined,
    caseTimeoutMinutes: optionalEnv('AGENT_VERIFICATION_TIMEOUT_MINUTES')
      ? parsePositiveNumber(optionalEnv('AGENT_VERIFICATION_TIMEOUT_MINUTES') ?? '')
      : undefined,
    engine: optionalEnv('AGENT_VERIFICATION_ENGINE') ?? 'codex',
    manifestPath: optionalEnv('AGENT_VERIFICATION_MANIFEST_PATH') ?? DEFAULT_MANIFEST_PATH,
    reportDir: optionalEnv('AGENT_VERIFICATION_REPORT_DIR') ?? DEFAULT_REPORT_DIR,
    allowedTargets: parseCsv(
      optionalEnv('AGENT_VERIFICATION_ALLOWED_TARGETS') ?? DEFAULT_ALLOWED_TARGETS.join(','),
    ),
    projectName: optionalEnv('AGENT_VERIFICATION_PROJECT_NAME') ?? DEFAULT_PROJECT_NAME,
    claudeMcpConfig:
      configuredClaudeMcpConfig ??
      (fs.existsSync(DEFAULT_CLAUDE_MCP_CONFIG) ? DEFAULT_CLAUDE_MCP_CONFIG : undefined),
    dryRun: false,
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
        args.engine = next();
        break;
      case '--engine-command-template':
        args.engineCommandTemplate = next();
        break;
      case '--manifest':
        args.manifestPath = next();
        break;
      case '--report-dir':
        args.reportDir = next();
        break;
      case '--allowed-targets':
        args.allowedTargets = parseCsv(next());
        break;
      case '--project-name':
        args.projectName = next();
        break;
      case '--claude-mcp-config':
        args.claudeMcpConfig = next();
        break;
      case '--no-claude-mcp-config':
        args.claudeMcpConfig = undefined;
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--help':
      case '-h':
        usage(0);
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        usage();
    }
  }

  if (args.allowedTargets.length === 0) {
    console.error('Agent verification requires at least one allowed target.');
    usage();
  }
  if (!args.target || !args.allowedTargets.includes(args.target)) {
    console.error(
      `Agent verification requires --target ${args.allowedTargets.join(', ')}.`,
    );
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

function readSuites(manifestPath: string): Record<string, SuiteCase[]> {
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

  const suites = readSuites(args.manifestPath);
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
  const lines = report.replace(/\r\n/g, '\n').trimEnd().split('\n');
  const finalLine = lines[lines.length - 1];
  const match = finalLine?.match(/^Status: (PASS|FAIL|BLOCKED|ABORTED)$/);
  return match?.[1] as AgentStatus | undefined;
}

function buildPrompt(params: {
  projectName: string;
  target: string;
  caseId: string;
  casePath: string;
  reportPath: string;
  caseMarkdown: string;
}): string {
  return `You are executing an agent test for ${params.projectName}.

Target environment: ${params.target}
Agent test id: ${params.caseId}
Agent test file: ${params.casePath}

Write the final verification report to this exact path:
${params.reportPath}

The report must include one final exact status line:
Status: PASS
Status: FAIL
Status: BLOCKED
or
Status: ABORTED

Use Status: BLOCKED only when environment, access, credentials, fixtures, or app
startup prevent product verification from starting. Once product verification
starts, return Status: PASS or Status: FAIL.

Use Status: ABORTED only when execution is externally interrupted before there
is enough evidence for PASS, FAIL, or a concrete environment/setup BLOCKED
result.

Execute the case below exactly.

${params.caseMarkdown}
`;
}

function runCase(args: Args, suiteCase: SuiteCase): CaseResult {
  if (!fs.existsSync(suiteCase.case)) {
    throw new Error(`Agent test does not exist: ${suiteCase.case}`);
  }

  fs.mkdirSync(args.reportDir, { recursive: true });
  const reportPath = path.join(args.reportDir, `${suiteCase.id}-${args.target}-${timestamp()}.md`);
  const absoluteReportPath = path.resolve(reportPath);
  const promptPath = path.join(
    os.tmpdir(),
    `${suiteCase.id}-${process.pid}-${Date.now()}.prompt.md`,
  );
  const caseMarkdown = fs.readFileSync(suiteCase.case, 'utf8');
  const prompt = buildPrompt({
    projectName: args.projectName,
    target: args.target ?? '',
    caseId: suiteCase.id,
    casePath: suiteCase.case,
    reportPath: absoluteReportPath,
    caseMarkdown,
  });
  fs.writeFileSync(promptPath, prompt);

  const timeoutMs = suiteCase.timeout_minutes * 60 * 1000;
  const env = {
    ...process.env,
    AGENT_VERIFICATION_TARGET: args.target ?? '',
    AGENT_VERIFICATION_CASE_ID: suiteCase.id,
    AGENT_VERIFICATION_CASE_PATH: path.resolve(suiteCase.case),
    AGENT_VERIFICATION_REPORT_PATH: absoluteReportPath,
    AGENT_VERIFICATION_REPORT_DIR: path.resolve(args.reportDir),
    AGENT_VERIFICATION_PROMPT_PATH: promptPath,
    AGENT_VERIFICATION_PROJECT_NAME: args.projectName,
  };

  let result: ReturnType<typeof spawnSync>;
  try {
    result = args.engineCommandTemplate
      ? spawnSync(
          // Test-only escape hatch for contract tests and local harness experiments.
          // Release workflows should use named engines, not shell templates.
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
        )
      : spawnSync(args.engine, engineArgs(args), {
          input: prompt,
          stdio: ['pipe', 'inherit', 'inherit'],
          timeout: timeoutMs,
          env,
        });
  } finally {
    fs.rmSync(promptPath, { force: true });
  }

  if (result.status !== 0) {
    const error = result.error as NodeJS.ErrnoException | undefined;
    return {
      id: suiteCase.id,
      casePath: suiteCase.case,
      required: suiteCase.required,
      status: error?.code === 'ETIMEDOUT' ? 'TIMED_OUT' : 'ENGINE_FAILED',
      reportPath,
      exitCode: result.status,
    };
  }

  if (!fs.existsSync(reportPath)) {
    return {
      id: suiteCase.id,
      casePath: suiteCase.case,
      required: suiteCase.required,
      status: 'MISSING_REPORT',
      reportPath,
      exitCode: result.status,
    };
  }

  const status = parseStatus(fs.readFileSync(reportPath, 'utf8'));
  return {
    id: suiteCase.id,
    casePath: suiteCase.case,
    required: suiteCase.required,
    status: status ?? 'MISSING_STATUS',
    reportPath,
    exitCode: result.status,
  };
}

function engineArgs(args: Args): string[] {
  switch (path.basename(args.engine)) {
    case 'codex':
      return ['exec', '-'];
    case 'claude': {
      const claudeArgs = ['--print', '--permission-mode', 'bypassPermissions'];
      if (args.claudeMcpConfig) {
        claudeArgs.push('--mcp-config', args.claudeMcpConfig);
      }
      return claudeArgs;
    }
    case 'gemini':
      // Gemini CLI headless mode appends piped stdin to --prompt.
      // Keep argv short and stream the full agent test through stdin.
      return ['--prompt', 'Read the verification instructions from stdin and execute them.'];
    default:
      console.warn(
        `Unknown agent verification engine "${args.engine}"; invoking it with stdin and no extra arguments.`,
      );
      return [];
  }
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
        engine: args.engineCommandTemplate ? 'custom-template' : args.engine,
        manifestPath: args.manifestPath,
        reportDir: args.reportDir,
        allowedTargets: args.allowedTargets,
        projectName: args.projectName,
        results,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Wrote summary: ${summaryPath}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cases = selectedCases(args);

  console.log(
    `Agent verification project=${args.projectName} target=${args.target} suite=${
      args.suite ?? '<single-case>'
    } cases=${cases.length}`,
  );
  for (const suiteCase of cases) {
    console.log(`- ${suiteCase.id}: ${suiteCase.case}`);
  }

  if (args.dryRun || cases.length === 0) {
    return;
  }

  if (!args.engineCommandTemplate && !commandExists(args.engine)) {
    throw new Error(`Agent verification engine not found on PATH: ${args.engine}`);
  }

  const results = cases.map((suiteCase) => runCase(args, suiteCase));
  writeSummary(args, results);

  let failed = false;
  for (const result of results) {
    console.log(`${result.id}: ${result.status} (${result.reportPath})`);
    if (result.required && result.status !== 'PASS') {
      failed = true;
    }
  }
  if (failed) {
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
