import type { ResolvedOptions } from "../config.js";
import type { HookResult, RunSummary, SpecResult } from "../results.js";

export interface RunInfo {
  version: string;
  files: string[];
  options: ResolvedOptions;
}

export interface RunTimings {
  discover: number;
  resolve: number;
  tests: number;
}

export interface RetryInfo {
  className: string;
  specName: string;
  /** the attempt that just failed, 1 based */
  attempt: number;
  remaining: number;
  error: unknown;
}

export interface Reporter {
  runStart(info: RunInfo): void;
  classStart(className: string): void;
  hookResult(result: HookResult): void;
  specResult(result: SpecResult): void;
  retry(info: RetryInfo): void;
  classEnd(className: string): void;
  runEnd(summary: RunSummary, timings?: RunTimings): void;
  /** flushes anything buffered, e.g. a report file */
  finalize(): Promise<void> | void;
}

export type Writer = (chunk: string) => void;

export class BaseReporter implements Reporter {
  constructor(protected write: Writer) {}

  runStart(_info: RunInfo) {}
  classStart(_className: string) {}
  hookResult(_result: HookResult) {}
  specResult(_result: SpecResult) {}
  retry(_info: RetryInfo) {}
  classEnd(_className: string) {}
  runEnd(_summary: RunSummary, _timings?: RunTimings) {}
  finalize(): Promise<void> | void {}

  protected line(text = "") {
    this.write(text + "\n");
  }
}

/** Fans every event out to a list of reporters. */
export class MultiReporter implements Reporter {
  constructor(private reporters: Reporter[]) {}

  runStart(info: RunInfo) {
    for (const reporter of this.reporters) reporter.runStart(info);
  }

  classStart(className: string) {
    for (const reporter of this.reporters) reporter.classStart(className);
  }

  hookResult(result: HookResult) {
    for (const reporter of this.reporters) reporter.hookResult(result);
  }

  specResult(result: SpecResult) {
    for (const reporter of this.reporters) reporter.specResult(result);
  }

  retry(info: RetryInfo) {
    for (const reporter of this.reporters) reporter.retry(info);
  }

  classEnd(className: string) {
    for (const reporter of this.reporters) reporter.classEnd(className);
  }

  runEnd(summary: RunSummary, timings?: RunTimings) {
    for (const reporter of this.reporters) reporter.runEnd(summary, timings);
  }

  async finalize() {
    for (const reporter of this.reporters) await reporter.finalize();
  }
}

/** A reporter that only makes sense once the whole run is over. */
export class BufferedReporter extends BaseReporter {
  protected buffer = "";

  protected emit(text: string) {
    this.buffer += text;
  }

  finalize() {
    if (this.buffer) {
      this.write(this.buffer);
      this.buffer = "";
    }
  }
}
