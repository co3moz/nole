import type { HookType } from "./test-wrap.js";

/**
 * ok       spec ran and passed
 * failed   spec ran and threw
 * skipped  statically skipped (skip_ prefix or Test({ skip }))
 * dskip    skipped at runtime through skipTest()/skipClass()
 * filtered rejected by --grep
 * blocked  never ran because a hook of the same class failed
 */
export type SpecStatus =
  | "ok"
  | "failed"
  | "skipped"
  | "dskip"
  | "filtered"
  | "blocked";

export type HookStatus = "ok" | "failed" | "dskip";

export interface SpecResult {
  className: string;
  specName: string;
  status: SpecStatus;
  /** milliseconds spent in the last attempt */
  duration: number;
  timeout: number;
  reason?: string;
  /** where a class level skip came from, e.g. ":before" */
  origin?: string;
  /** 1 means it passed (or failed) on the first try */
  attempts: number;
  /** failed at least once but eventually passed thanks to --retries */
  flaky: boolean;
  error?: unknown;
}

export interface HookResult {
  className: string;
  /** display name, e.g. "QueueTest:before" */
  hookName: string;
  type: HookType;
  status: HookStatus;
  duration: number;
  timeout: number;
  reason?: string;
  error?: unknown;
}

export interface RunSummary {
  passed: number;
  failed: number;
  skipped: number;
  blocked: number;
  filtered: number;
  flaky: number;
  total: number;
  /** wall clock milliseconds spent running specs */
  duration: number;
  /** true when the run stopped early (--bail or SIGINT) */
  aborted: boolean;
  specs: SpecResult[];
  hooks: HookResult[];
}

export function summarize(
  specs: SpecResult[],
  hooks: HookResult[],
  duration: number,
  aborted: boolean,
): RunSummary {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let blocked = 0;
  let filtered = 0;
  let flaky = 0;

  for (const spec of specs) {
    switch (spec.status) {
      case "ok":
        passed++;
        break;
      case "failed":
        failed++;
        break;
      case "blocked":
        blocked++;
        break;
      case "filtered":
        filtered++;
        break;
      default:
        skipped++;
    }

    if (spec.flaky) {
      flaky++;
    }
  }

  for (const hook of hooks) {
    if (hook.status === "failed") {
      failed++;
    }
  }

  return {
    passed,
    failed,
    skipped,
    blocked,
    filtered,
    flaky,
    total: specs.length,
    duration,
    aborted,
    specs,
    hooks,
  };
}
