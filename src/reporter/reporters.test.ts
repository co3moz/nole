import * as assert from "assert";
import { Test } from "../index.js";
import { resolveOptions } from "../config.js";
import { HookType } from "../test-wrap.js";
import { summarize, type HookResult, type SpecResult } from "../results.js";
import { BaseReporter, MultiReporter, type Reporter } from "./base.js";
import { createReporter } from "./index.js";

function spec(over: Partial<SpecResult> = {}): SpecResult {
  return {
    className: "QueueTest",
    specName: "push",
    status: "ok",
    duration: 1,
    timeout: 5000,
    attempts: 1,
    flaky: false,
    ...over,
  };
}

function hook(over: Partial<HookResult> = {}): HookResult {
  return {
    className: "QueueTest",
    hookName: "QueueTest:before",
    type: HookType.Before,
    status: "ok",
    duration: 1,
    timeout: 5000,
    ...over,
  };
}

const SPECS: SpecResult[] = [
  spec(),
  spec({ specName: "flakyOne", attempts: 3, flaky: true }),
  spec({ specName: "boom", status: "failed", error: new Error("kaboom") }),
  spec({ specName: "old", status: "skipped", reason: "marked as skipped" }),
  spec({ specName: "later", status: "dskip", reason: "no url", origin: ":before" }),
  spec({ specName: "gone", status: "blocked", reason: "before hook failed" }),
  spec({ specName: "other", status: "filtered" }),
];

const HOOKS: HookResult[] = [
  hook(),
  hook({ hookName: "QueueTest:after", type: HookType.After, status: "dskip", reason: "nope" }),
  hook({
    hookName: "QueueTest.custom:before",
    status: "failed",
    error: new Error("hook exploded"),
  }),
];

const ANSI = /\u001b\[[0-9;]*m/g;

/**
 * Feeds a full run through a reporter and returns everything it wrote, without
 * the colour codes — otherwise these assertions would only hold when the outer
 * run happens to be piped somewhere that has no colours.
 */
async function drive(name: any, concurrency = 1) {
  let out = "";
  const reporter = createReporter(name, (chunk) => {
    out += chunk;
  });

  const options = resolveOptions({ concurrency });

  reporter.runStart({ version: "9.9.9", files: ["a.test.ts"], options });
  reporter.classStart("QueueTest");

  for (const result of HOOKS) reporter.hookResult(result);
  for (const result of SPECS) reporter.specResult(result);

  reporter.retry({
    className: "QueueTest",
    specName: "flakyOne",
    attempt: 1,
    remaining: 2,
    error: new Error("not yet"),
  });

  reporter.classEnd("QueueTest");
  reporter.runEnd(summarize(SPECS, HOOKS, 1234, false), {
    discover: 1,
    resolve: 2,
    tests: 1234,
  });

  await reporter.finalize();

  return out.replace(ANSI, "");
}

export class ReporterTest extends Test() {
  async spec() {
    const out = await drive("spec");

    assert.ok(out.includes("Nole tests v9.9.9"));
    assert.ok(out.includes("QueueTest.push()"));
    assert.ok(out.includes("flaky, passed on attempt 3"));
    assert.ok(out.includes("kaboom"));
    assert.ok(out.includes("marked as skipped"));
    assert.ok(out.includes("skip came from :before"));
    assert.ok(out.includes("before hook failed"));
    assert.ok(!out.includes("QueueTest.other"), "filtered specs stay quiet");
    assert.ok(out.includes("Failures:"));
    assert.ok(out.includes("2 failed"), out);
    assert.ok(out.includes("1 flaky"));
    assert.ok(out.includes("1 filtered"));
    assert.ok(out.includes("discover:"));
  }

  async specBuffersWhenParallel() {
    const out = await drive("spec", 4);

    // the whole class still shows up, just as one block
    assert.ok(out.includes("QueueTest.push()"));
    assert.ok(out.indexOf("Nole tests") < out.indexOf("QueueTest.push()"));
  }

  async abortedRunSaysSo() {
    let out = "";
    const reporter = createReporter("spec", (chunk) => (out += chunk));

    reporter.runStart({
      version: "1",
      files: [],
      options: resolveOptions({}),
    });
    reporter.runEnd(summarize([], [], 5, true));

    assert.ok(out.includes("run stopped early"));
  }

  async dot() {
    const out = await drive("dot");

    assert.ok(out.includes("Nole tests v9.9.9"));
    assert.ok(/[.F~!-]/.test(out));
    assert.ok(out.includes("Failures:"), "the recap is shared with spec");
  }

  async json() {
    const parsed = JSON.parse(await drive("json"));

    assert.equal(parsed.version, "9.9.9");
    assert.equal(parsed.summary.passed, 2);
    assert.equal(parsed.summary.failed, 2);
    assert.equal(parsed.summary.filtered, 1);
    assert.equal(parsed.specs.length, SPECS.length);
    assert.equal(parsed.specs[2].error.message, "kaboom");
    assert.ok(parsed.specs[2].error.stack);
    assert.equal(parsed.specs[0].error, undefined);
    assert.equal(parsed.hooks[2].error.message, "hook exploded");
    assert.equal(parsed.timings.tests, 1234);
  }

  async jsonSerializesOddThrows() {
    let out = "";
    const reporter = createReporter("json", (chunk) => (out += chunk));

    reporter.runEnd(summarize([spec({ status: "failed", error: "a string" })], [], 1, false));
    await reporter.finalize();

    assert.equal(JSON.parse(out).specs[0].error.message, "a string");
  }

  async tap() {
    const lines = (await drive("tap")).split("\n");

    assert.equal(lines[0], "TAP version 13");
    assert.ok(lines.some((line) => line.startsWith("ok 1 - QueueTest.push")));
    assert.ok(lines.some((line) => line.startsWith("not ok 3 - QueueTest.boom")));
    assert.ok(lines.some((line) => line.includes("# SKIP marked as skipped")));
    assert.ok(
      lines.some((line) => line.startsWith("not ok 7 - QueueTest.custom:before")),
      "failed hooks are reported as their own points",
    );
    assert.ok(lines.includes("1..7"), lines.join("\n"));
    assert.ok(lines.some((line) => line.includes("stack: |-")));
  }

  async junit() {
    const xml = await drive("junit");

    assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
    assert.ok(xml.includes('<testsuite name="QueueTest"'));
    assert.ok(xml.includes('<testcase classname="QueueTest" name="push"'));
    assert.ok(xml.includes('<failure message="kaboom">'));
    assert.ok(xml.includes('<skipped message="marked as skipped" />'));
    assert.ok(!xml.includes('name="other"'), "filtered specs are not reported");
  }

  async junitEscapes() {
    let out = "";
    const reporter = createReporter("junit", (chunk) => (out += chunk));
    const bell = String.fromCharCode(7);

    reporter.runEnd(
      summarize(
        [
          spec({
            className: 'Weird"&<>',
            status: "failed",
            error: `bad ${bell} value`,
          }),
        ],
        [],
        1,
        false,
      ),
    );
    await reporter.finalize();

    assert.ok(out.includes("Weird&quot;&amp;&lt;&gt;"));
    assert.ok(!out.includes(bell), "control characters are stripped");
  }

  multi() {
    const seen: string[] = [];

    const fake = (name: string): Reporter => {
      const reporter = new BaseReporter(() => {});

      for (const event of [
        "runStart",
        "classStart",
        "hookResult",
        "specResult",
        "retry",
        "classEnd",
        "runEnd",
        "finalize",
      ]) {
        (reporter as any)[event] = () => seen.push(`${name}:${event}`);
      }

      return reporter;
    };

    const multi = new MultiReporter([fake("a"), fake("b")]);

    multi.runStart({ version: "1", files: [], options: resolveOptions({}) });
    multi.classStart("X");
    multi.hookResult(hook());
    multi.specResult(spec());
    multi.retry({
      className: "X",
      specName: "y",
      attempt: 1,
      remaining: 0,
      error: null,
    });
    multi.classEnd("X");
    multi.runEnd(summarize([], [], 1, false));

    assert.equal(seen.length, 14);
    assert.ok(seen.includes("a:runStart"));
    assert.ok(seen.includes("b:runEnd"));
  }

  async baseReporterDoesNothing() {
    let out = "";
    const reporter = new BaseReporter((chunk) => (out += chunk));

    reporter.runStart({ version: "1", files: [], options: resolveOptions({}) });
    reporter.classStart("X");
    reporter.hookResult(hook());
    reporter.specResult(spec());
    reporter.retry({
      className: "X",
      specName: "y",
      attempt: 1,
      remaining: 0,
      error: null,
    });
    reporter.classEnd("X");
    reporter.runEnd(summarize([], [], 1, false));
    await reporter.finalize();

    assert.equal(out, "");
  }
}
