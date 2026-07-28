import type { HookResult, RunSummary, SpecResult } from "../results.js";
import { cleanStack } from "../utils/stack.js";
import { BufferedReporter } from "./base.js";

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // control characters are not valid in XML 1.0
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function seconds(ms: number): string {
  return (ms / 1000).toFixed(3);
}

function failureBody(error: unknown): string {
  if (error instanceof Error) {
    return escape(error.stack ? cleanStack(error.stack) : error.message);
  }

  return escape(String(error));
}

function failureMessage(error: unknown): string {
  return escape(error instanceof Error ? error.message : String(error));
}

/** JUnit XML, the format most CI providers ingest for test reporting. */
export class JUnitReporter extends BufferedReporter {
  runEnd(summary: RunSummary) {
    const classes = new Map<
      string,
      { specs: SpecResult[]; hooks: HookResult[] }
    >();

    const bucket = (className: string) => {
      let entry = classes.get(className);

      if (!entry) {
        entry = { specs: [], hooks: [] };
        classes.set(className, entry);
      }

      return entry;
    };

    for (const spec of summary.specs) {
      if (spec.status !== "filtered") {
        bucket(spec.className).specs.push(spec);
      }
    }

    for (const hook of summary.hooks) {
      if (hook.status === "failed") {
        bucket(hook.className).hooks.push(hook);
      }
    }

    const out: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];

    // failed hooks are written as their own testcases, so they count too
    const total =
      summary.total -
      summary.filtered +
      summary.hooks.filter((hook) => hook.status === "failed").length;

    out.push(
      `<testsuites name="nole" tests="${total}" failures="${summary.failed}" skipped="${summary.skipped + summary.blocked}" time="${seconds(summary.duration)}">`,
    );

    for (const [className, entry] of classes) {
      const failures =
        entry.specs.filter((spec) => spec.status === "failed").length +
        entry.hooks.length;
      const skipped = entry.specs.filter(
        (spec) => spec.status !== "ok" && spec.status !== "failed",
      ).length;
      const time = entry.specs.reduce((total, spec) => total + spec.duration, 0);

      out.push(
        `  <testsuite name="${escape(className)}" tests="${entry.specs.length + entry.hooks.length}" failures="${failures}" skipped="${skipped}" time="${seconds(time)}">`,
      );

      for (const spec of entry.specs) {
        const head = `    <testcase classname="${escape(className)}" name="${escape(spec.specName)}" time="${seconds(spec.duration)}"`;

        if (spec.status === "ok") {
          out.push(`${head} />`);
          continue;
        }

        if (spec.status === "failed") {
          out.push(`${head}>`);
          out.push(
            `      <failure message="${failureMessage(spec.error)}">${failureBody(spec.error)}</failure>`,
          );
          out.push("    </testcase>");
          continue;
        }

        out.push(`${head}>`);
        out.push(
          `      <skipped message="${escape(spec.reason ?? spec.status)}" />`,
        );
        out.push("    </testcase>");
      }

      for (const hook of entry.hooks) {
        out.push(
          `    <testcase classname="${escape(className)}" name="${escape(hook.hookName)}" time="${seconds(hook.duration)}">`,
        );
        out.push(
          `      <failure message="${failureMessage(hook.error)}">${failureBody(hook.error)}</failure>`,
        );
        out.push("    </testcase>");
      }

      out.push("  </testsuite>");
    }

    out.push("</testsuites>");

    this.emit(out.join("\n") + "\n");
  }
}
