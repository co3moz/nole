import type { ReporterName, ReporterOption } from "../config.js";
import { type Reporter, type Writer } from "./base.js";
import { SpecReporter } from "./spec.js";
import { DotReporter } from "./dot.js";
import { JsonReporter } from "./json.js";
import { TapReporter } from "./tap.js";
import { JUnitReporter } from "./junit.js";

export {
  BaseReporter,
  BufferedReporter,
  MultiReporter,
  type Reporter,
  type RetryInfo,
  type RunInfo,
  type RunTimings,
  type Writer,
} from "./base.js";

export { SpecReporter, DotReporter, JsonReporter, TapReporter, JUnitReporter };

/**
 * Turns whatever the options carry into a reporter: a built in name, a reporter
 * of your own, or a factory that is handed the output stream.
 */
export function resolveReporter(
  option: ReporterOption,
  write: Writer,
): Reporter {
  if (typeof option === "string") {
    return createReporter(option, write);
  }

  if (typeof option === "function") {
    return option(write);
  }

  return option;
}

export function createReporter(name: ReporterName, write: Writer): Reporter {
  switch (name) {
    case "dot":
      return new DotReporter(write);
    case "json":
      return new JsonReporter(write);
    case "tap":
      return new TapReporter(write);
    case "junit":
      return new JUnitReporter(write);
    default:
      return new SpecReporter(write);
  }
}
