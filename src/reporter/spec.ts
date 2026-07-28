import {
  BLOCKED_TEXT,
  colors,
  DYNAMIC_SKIP_TEXT,
  FAILED_TEXT,
  OK_TEXT,
  RETRY_TEXT,
  SKIP_TEXT,
  TIME_WIDTH,
} from "../const.js";
import type { HookResult, RunSummary, SpecResult } from "../results.js";
import { errorHeadline, formatError } from "../utils/stack.js";
import { TimeFactor, TimeResolve } from "../utils/time_factor.js";
import {
  BaseReporter,
  type RetryInfo,
  type RunInfo,
  type RunTimings,
} from "./base.js";

const BLANK = " ".repeat(TIME_WIDTH);
const ORIGIN_INDENT = " ".repeat(22);

/** The human readable default output. */
export class SpecReporter extends BaseReporter {
  private buffering = false;
  private buffers = new Map<string, string[]>();

  runStart(info: RunInfo) {
    // With more than one class in flight the lines would interleave, so each
    // class gets buffered and flushed as a block instead.
    this.buffering = info.options.concurrency > 1;

    this.line(`Nole tests v${info.version}`);
  }

  classStart(className: string) {
    if (this.buffering) {
      this.buffers.set(className, []);
    }
  }

  classEnd(className: string) {
    const buffer = this.buffers.get(className);

    if (buffer) {
      this.buffers.delete(className);
      this.write(buffer.join(""));
    }
  }

  specResult(result: SpecResult) {
    if (result.status === "filtered") {
      return;
    }

    const name = colors.bold(
      colors.yellow(`${result.className}.${result.specName}`),
    );
    const reason = result.reason ? ` {${result.reason}}` : "";

    switch (result.status) {
      case "ok": {
        const time = TimeFactor(result.duration, result.timeout);
        const flaky = result.flaky
          ? colors.magenta(` (flaky, passed on attempt ${result.attempts})`)
          : "";

        this.out(result.className, `${OK_TEXT} ${time} ${name}()${flaky}`);
        break;
      }

      case "failed": {
        const time = TimeFactor(result.duration, result.timeout);

        this.out(result.className, `${FAILED_TEXT} ${time} ${name}()`);
        this.out(
          result.className,
          colors.red(`${" ".repeat(11)}${errorHeadline(result.error)}`),
        );
        break;
      }

      case "skipped":
        this.out(result.className, `${SKIP_TEXT} ${BLANK} ${name}()${reason}`);
        break;

      case "blocked":
        this.out(
          result.className,
          `${BLOCKED_TEXT} ${BLANK} ${name}()${reason}`,
        );
        break;

      default: {
        let text = `${DYNAMIC_SKIP_TEXT} ${BLANK} ${name}()${reason}`;

        if (result.origin) {
          text += `\n${ORIGIN_INDENT}↳ skip came from ${result.origin}`;
        }

        this.out(result.className, text);
      }
    }
  }

  hookResult(result: HookResult) {
    const name = colors.bold(colors.yellow(result.hookName));

    if (result.status === "dskip") {
      const reason = result.reason ? ` {${result.reason}}` : "";

      this.out(
        result.className,
        `${DYNAMIC_SKIP_TEXT} ${BLANK} ${name}()${reason}`,
      );
      return;
    }

    const time = TimeFactor(result.duration, result.timeout);

    if (result.status === "ok") {
      this.out(result.className, `${OK_TEXT} ${time} ${name}()`);
      return;
    }

    this.out(result.className, `${FAILED_TEXT} ${time} ${name}()`);
    this.out(
      result.className,
      colors.red(`${" ".repeat(11)}${errorHeadline(result.error)}`),
    );
  }

  retry(info: RetryInfo) {
    const name = colors.bold(
      colors.yellow(`${info.className}.${info.specName}`),
    );

    this.out(
      info.className,
      `${RETRY_TEXT} ${BLANK} ${name}() {attempt ${info.attempt} failed, ${info.remaining} left}`,
    );
  }

  runEnd(summary: RunSummary, timings?: RunTimings) {
    const failures: Array<{ title: string; error: unknown }> = [];

    for (const spec of summary.specs) {
      if (spec.status === "failed") {
        failures.push({
          title: `${spec.className}.${spec.specName}()`,
          error: spec.error,
        });
      }
    }

    for (const hook of summary.hooks) {
      if (hook.status === "failed") {
        failures.push({ title: `${hook.hookName}()`, error: hook.error });
      }
    }

    if (failures.length) {
      this.line();
      this.line(colors.bold(colors.red("  Failures:")));

      failures.forEach((failure, index) => {
        this.line();
        this.line(`  ${index + 1}) ${colors.bold(failure.title)}`);
        this.line(formatError(failure.error, "     "));
      });
    }

    this.line();
    this.line("  " + this.counts(summary));

    if (summary.aborted) {
      this.line(
        colors.bold(
          colors.red("  run stopped early, remaining tests did not run"),
        ),
      );
    }

    if (timings) {
      this.line();
      this.line(` discover: ${TimeResolve(timings.discover)}`);
      this.line(`  resolve: ${TimeResolve(timings.resolve)}`);
      this.line(`    tests: ${TimeResolve(timings.tests)}`);
    }
  }

  private counts(summary: RunSummary) {
    const parts = [
      colors.green(`${summary.passed} passed`),
      summary.failed ? colors.red(`${summary.failed} failed`) : "",
      summary.skipped ? colors.yellow(`${summary.skipped} skipped`) : "",
      summary.blocked ? colors.grey(`${summary.blocked} blocked`) : "",
      summary.filtered ? colors.grey(`${summary.filtered} filtered`) : "",
      summary.flaky ? colors.magenta(`${summary.flaky} flaky`) : "",
    ].filter(Boolean);

    return `${parts.join(", ")}  (${TimeResolve(summary.duration)})`;
  }

  private out(className: string, text: string) {
    const buffer = this.buffers.get(className);

    if (buffer) {
      buffer.push(text + "\n");
      return;
    }

    this.line(text);
  }
}
