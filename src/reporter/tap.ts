import type { RunSummary } from "../results.js";
import { cleanStack } from "../utils/stack.js";
import { BufferedReporter } from "./base.js";

function yamlBlock(error: unknown): string {
  const message =
    error instanceof Error ? error.message : String(error ?? "failed");
  const stack = error instanceof Error && error.stack ? error.stack : "";

  const lines = ["  ---", `  message: ${JSON.stringify(message)}`, "  severity: fail"];

  if (stack) {
    lines.push("  stack: |-");

    for (const line of cleanStack(stack).split("\n")) {
      lines.push(`    ${line}`);
    }
  }

  lines.push("  ...");

  return lines.join("\n");
}

/** TAP version 13, for CI systems and `tap-*` consumers. */
export class TapReporter extends BufferedReporter {
  runEnd(summary: RunSummary) {
    const lines = ["TAP version 13"];
    let index = 0;

    for (const spec of summary.specs) {
      if (spec.status === "filtered") {
        continue;
      }

      const name = `${spec.className}.${spec.specName}`;
      index++;

      if (spec.status === "failed") {
        lines.push(`not ok ${index} - ${name}`);
        lines.push(yamlBlock(spec.error));
        continue;
      }

      if (spec.status === "ok") {
        lines.push(`ok ${index} - ${name}`);
        continue;
      }

      lines.push(
        `ok ${index} - ${name} # SKIP ${spec.reason ?? spec.status}`.trimEnd(),
      );
    }

    for (const hook of summary.hooks) {
      if (hook.status !== "failed") {
        continue;
      }

      index++;
      lines.push(`not ok ${index} - ${hook.hookName}`);
      lines.push(yamlBlock(hook.error));
    }

    lines.push(`1..${index}`);

    this.emit(lines.join("\n") + "\n");
  }
}
