import { colors } from "../const.js";
import type { HookResult, RunSummary, SpecResult } from "../results.js";
import type { RunInfo, RunTimings } from "./base.js";
import { SpecReporter } from "./spec.js";

const WIDTH = 60;

/**
 * One character per spec, then the same failure recap and summary the spec
 * reporter prints. Handy for suites too large to read line by line.
 */
export class DotReporter extends SpecReporter {
  private column = 0;

  runStart(info: RunInfo) {
    this.line(`Nole tests v${info.version}`);
    this.line();
  }

  classStart(_className: string) {}
  classEnd(_className: string) {}
  retry() {
    this.dot(colors.magenta("↻"));
  }

  specResult(result: SpecResult) {
    switch (result.status) {
      case "ok":
        this.dot(result.flaky ? colors.magenta("!") : colors.green("."));
        break;
      case "failed":
        this.dot(colors.red("F"));
        break;
      case "filtered":
        break;
      case "blocked":
        this.dot(colors.grey("~"));
        break;
      default:
        this.dot(colors.yellow("-"));
    }
  }

  hookResult(result: HookResult) {
    if (result.status === "failed") {
      this.dot(colors.red("H"));
    }
  }

  runEnd(summary: RunSummary, timings?: RunTimings) {
    if (this.column) {
      this.line();
    }

    super.runEnd(summary, timings);
  }

  private dot(char: string) {
    this.write(char);

    if (++this.column >= WIDTH) {
      this.column = 0;
      this.write("\n");
    }
  }
}
