import * as assert from "assert";
import { Test } from "./index.js";
import {
  createMatcher,
  defaultOptions,
  defineConfig,
  parseReportTarget,
  parseReporter,
  resolveOptions,
} from "./config.js";

export class ConfigTest extends Test() {
  defaults() {
    const options = defaultOptions({});

    assert.equal(options.bail, false);
    assert.equal(options.retries, 0);
    assert.equal(options.concurrency, 1);
    assert.equal(options.reporter, "spec");
    assert.equal(options.timeout, null);
    assert.equal(options.wait, 0);
    assert.equal(options.specSkipPrefix, "_");
  }

  environment() {
    const options = defaultOptions({
      NOLE_WAIT_PERIOD: "250",
      SPEC_SKIP_PREFIX: "$",
    });

    assert.equal(options.wait, 250);
    assert.equal(options.specSkipPrefix, "$");

    // a nonsense value falls back instead of poisoning the run
    assert.equal(defaultOptions({ NOLE_WAIT_PERIOD: "nope" }).wait, 0);
    assert.equal(defaultOptions({ NOLE_WAIT_PERIOD: "-5" }).wait, 0);
  }

  precedence() {
    const options = resolveOptions(
      { retries: 3 },
      { retries: 1, bail: true, globs: ["./x"] },
      {},
    );

    assert.equal(options.retries, 3, "the command line wins");
    assert.equal(options.bail, true, "the config file fills the rest in");
    assert.deepEqual(options.globs, ["./x"]);
  }

  coercion() {
    const options = resolveOptions(
      { timeout: "1500" as any, concurrency: "4" as any, wait: "10" as any },
      {},
      {},
    );

    assert.strictEqual(options.timeout, 1500);
    assert.strictEqual(options.concurrency, 4);
    assert.strictEqual(options.wait, 10);

    // concurrency never drops below one, otherwise nothing would ever start
    assert.equal(resolveOptions({ concurrency: 0 }, {}, {}).concurrency, 1);

    assert.throws(
      () => resolveOptions({ retries: "many" as any }, {}, {}),
      /--retries/,
    );
    assert.throws(() => resolveOptions({ timeout: -1 }, {}, {}), /--timeout/);
  }

  reporterNames() {
    assert.equal(parseReporter("junit"), "junit");
    assert.throws(() => parseReporter("nope"), /Unknown reporter/);

    assert.deepEqual(parseReportTarget("junit:results.xml"), {
      name: "junit",
      file: "results.xml",
    });

    // windows style paths keep their drive letter
    assert.deepEqual(parseReportTarget("json:C:/tmp/out.json"), {
      name: "json",
      file: "C:/tmp/out.json",
    });

    assert.throws(() => parseReportTarget("junit"), /--report expects/);
  }

  matcher() {
    assert.equal(createMatcher(null), null);

    const substring = createMatcher("push")!;

    assert.equal(substring("QueueTest", "push"), true);
    assert.equal(substring("QueueTest", "PUSH"), true, "case insensitive");
    assert.equal(substring("QueueTest", "pop"), false);

    const qualified = createMatcher("QueueTest.push")!;

    assert.equal(qualified("QueueTest", "push"), true);
    assert.equal(qualified("OtherTest", "push"), false);

    const regex = createMatcher("/^Queue.*\\.p/")!;

    assert.equal(regex("QueueTest", "push"), true);
    assert.equal(regex("QueueTest", "shift"), false);

    const insensitive = createMatcher("/queuetest/i")!;

    assert.equal(insensitive("QueueTest", "anything"), true);
  }

  defineConfigIsIdentity() {
    const options = { retries: 2 };

    assert.deepEqual(defineConfig(options), options);
  }
}
