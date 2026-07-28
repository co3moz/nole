import type { ReporterName } from "../config.js";
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
