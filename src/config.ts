import type { Reporter, Writer } from "./reporter/base.js";

export const REPORTERS = ["spec", "dot", "json", "tap", "junit"] as const;

export type ReporterName = (typeof REPORTERS)[number];

/** Builds a reporter around the stream nole hands it. */
export type ReporterFactory = (write: Writer) => Reporter;

/** One of the built in names, a reporter of your own, or a factory for one. */
export type ReporterOption = ReporterName | Reporter | ReporterFactory;

export interface ReportTarget {
  name: ReporterName;
  file: string;
}

/**
 * What a nole.config.{ts,js,mjs,cjs} file may export as its default. Every key
 * mirrors a command line flag; the flag always wins.
 */
export interface NoleOptions {
  globs?: string[];
  bail?: boolean;
  grep?: string | null;
  /** overrides every Test({ timeout }) when set */
  timeout?: number | null;
  retries?: number;
  concurrency?: number;
  reporter?: ReporterOption;
  reports?: ReportTarget[];
  setup?: string[];
  wait?: number;
  specSkipPrefix?: string;
}

export interface ResolvedOptions {
  globs: string[];
  bail: boolean;
  grep: string | null;
  timeout: number | null;
  retries: number;
  concurrency: number;
  reporter: ReporterOption;
  reports: ReportTarget[];
  setup: string[];
  wait: number;
  specSkipPrefix: string;
}

/** Identity helper that gives a nole.config file type checking and completion. */
export function defineConfig(options: NoleOptions): NoleOptions {
  return options;
}

export function defaultOptions(env: NodeJS.ProcessEnv = process.env) {
  const wait = Number(env.NOLE_WAIT_PERIOD);

  const options: ResolvedOptions = {
    globs: [],
    bail: false,
    grep: null,
    timeout: null,
    retries: 0,
    concurrency: 1,
    reporter: "spec",
    reports: [],
    setup: [],
    wait: isNaN(wait) || wait < 0 ? 0 : wait,
    specSkipPrefix: env.SPEC_SKIP_PREFIX ?? "_",
  };

  return options;
}

function isReporter(value: string): value is ReporterName {
  return (REPORTERS as readonly string[]).includes(value);
}

export function parseReporter(value: string): ReporterName {
  if (!isReporter(value)) {
    throw new Error(
      `Unknown reporter "${value}". Available: ${REPORTERS.join(", ")}`,
    );
  }

  return value;
}

/** `--report junit:results.xml` */
export function parseReportTarget(value: string): ReportTarget {
  // the first colon separates, so a windows path like junit:C:\out.xml works
  const separator = value.indexOf(":");

  if (separator < 1) {
    throw new Error(
      `--report expects <reporter>:<file>, got "${value}" (e.g. junit:results.xml)`,
    );
  }

  return {
    name: parseReporter(value.slice(0, separator)),
    file: value.slice(separator + 1),
  };
}

function positive(value: unknown, flag: string): number {
  const parsed = Number(value);

  if (isNaN(parsed) || parsed < 0) {
    throw new Error(`${flag} expects a number that is 0 or higher`);
  }

  return parsed;
}

/**
 * Merges the three sources of truth. Command line beats config file, config
 * file beats the defaults (which already carry the environment variables).
 */
export function resolveOptions(
  cli: NoleOptions,
  file: NoleOptions = {},
  env: NodeJS.ProcessEnv = process.env,
): ResolvedOptions {
  const options = defaultOptions(env);

  for (const source of [file, cli]) {
    for (const key of Object.keys(source) as Array<keyof NoleOptions>) {
      const value = source[key];

      if (value === undefined) {
        continue;
      }

      (options as any)[key] = value;
    }
  }

  // a name from a config file deserves the same check the command line gets
  if (typeof options.reporter === "string") {
    options.reporter = parseReporter(options.reporter);
  }

  options.concurrency = Math.max(1, positive(options.concurrency, "--concurrency"));
  options.retries = positive(options.retries, "--retries");
  options.wait = positive(options.wait, "--wait");

  if (options.timeout !== null) {
    options.timeout = positive(options.timeout, "--timeout");
  }

  return options;
}

export interface SpecMatcher {
  (className: string, specName: string): boolean;
}

/**
 * `--grep` matches against "ClassName.specName". A `/pattern/flags` shaped value
 * is treated as a regular expression, anything else as a case insensitive
 * substring.
 */
export function createMatcher(pattern: string | null): SpecMatcher | null {
  if (!pattern) {
    return null;
  }

  const regex = /^\/(.*)\/([a-z]*)$/.exec(pattern);

  if (regex) {
    const compiled = new RegExp(regex[1], regex[2]);

    return (className, specName) =>
      compiled.test(`${className}.${specName}`) ||
      compiled.test(className) ||
      compiled.test(specName);
  }

  const needle = pattern.toLowerCase();

  return (className, specName) =>
    `${className}.${specName}`.toLowerCase().includes(needle);
}
