import type { RunSummary } from "../results.js";
import { cleanStack } from "../utils/stack.js";
import { BufferedReporter, type RunInfo, type RunTimings } from "./base.js";

function serializeError(error: unknown) {
  if (error === undefined) {
    return undefined;
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ? cleanStack(error.stack) : undefined,
      actual: (error as any).actual,
      expected: (error as any).expected,
    };
  }

  return { name: "Error", message: String(error) };
}

/** Machine readable output for tooling that wants the whole run at once. */
export class JsonReporter extends BufferedReporter {
  private info: RunInfo | null = null;

  runStart(info: RunInfo) {
    this.info = info;
  }

  runEnd(summary: RunSummary, timings?: RunTimings) {
    this.emit(
      JSON.stringify(
        {
          version: this.info?.version ?? null,
          files: this.info?.files ?? [],
          timings: timings ?? null,
          summary: {
            passed: summary.passed,
            failed: summary.failed,
            skipped: summary.skipped,
            blocked: summary.blocked,
            filtered: summary.filtered,
            flaky: summary.flaky,
            total: summary.total,
            duration: summary.duration,
            aborted: summary.aborted,
          },
          specs: summary.specs.map((spec) => ({
            class: spec.className,
            spec: spec.specName,
            status: spec.status,
            duration: spec.duration,
            attempts: spec.attempts,
            flaky: spec.flaky,
            reason: spec.reason,
            origin: spec.origin,
            error: serializeError(spec.error),
          })),
          hooks: summary.hooks.map((hook) => ({
            class: hook.className,
            hook: hook.hookName,
            status: hook.status,
            duration: hook.duration,
            reason: hook.reason,
            error: serializeError(hook.error),
          })),
        },
        null,
        2,
      ) + "\n",
    );
  }
}
