import * as assert from "assert";
import { Test } from "./index.js";
import { resolveOptions, type NoleOptions } from "./config.js";
import { createReporter } from "./reporter/index.js";
import { createRunContext, ManualRun } from "./run.js";
import { addTest, skipClass, skipTest } from "./dynamic.js";
import type { RunSummary } from "./results.js";

/** These classes are meant to misbehave, so nothing they print is interesting. */
function drive(target: any, options: NoleOptions = {}): Promise<RunSummary> {
  return driveAll([target], options);
}

function driveAll(
  targets: any[],
  options: NoleOptions = {},
): Promise<RunSummary> {
  return ManualRun(
    new Set<any>(targets),
    createRunContext({
      reporter: createReporter("json", () => {}),
      options: resolveOptions(options),
    }),
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function statuses(summary: RunSummary) {
  return summary.specs.map((spec) => `${spec.specName}:${spec.status}`);
}

const trace: string[] = [];

// Every spec here drives a nested run against the shared registry, so this
// class has to have the runner to itself.
export class LifecycleTest extends Test({ exclusive: true }) {
  async beforeHookFailureBlocksTheClass() {
    class BeforeFails extends Test() {
      before() {
        throw new Error("no connection");
      }

      first() {
        assert.fail("must not run");
      }

      second() {
        assert.fail("must not run");
      }

      after() {
        trace.push("after ran");
      }

      cleanUp() {
        trace.push("cleanUp ran");
      }
    }

    trace.length = 0;

    const summary = await drive(BeforeFails);

    assert.equal(summary.failed, 1, "the hook is the failure");
    assert.deepEqual(statuses(summary), [
      "first:blocked",
      "second:blocked",
    ]);
    assert.deepEqual(
      trace,
      ["cleanUp ran"],
      "after is skipped but cleanUp still releases resources",
    );
  }

  async beforeEachFailureStopsTheClass() {
    class BeforeEachFails extends Test() {
      beforeEach() {
        throw new Error("bad state");
      }

      first() {
        assert.fail("must not run");
      }

      second() {
        assert.fail("must not run");
      }
    }

    const summary = await drive(BeforeEachFails);

    assert.equal(summary.failed, 1);
    assert.deepEqual(statuses(summary), ["first:blocked", "second:blocked"]);
  }

  async afterEachFailureStopsTheClass() {
    class AfterEachFails extends Test() {
      afterEach() {
        throw new Error("cleanup of the spec failed");
      }

      first() {}

      second() {
        assert.fail("must not run");
      }
    }

    const summary = await drive(AfterEachFails);

    assert.equal(summary.failed, 1);
    assert.deepEqual(statuses(summary), ["first:ok", "second:blocked"]);
  }

  async classSkipFromBeforeEach() {
    class SkipFromBeforeEach extends Test() {
      beforeEach() {
        skipClass("nothing to test today");
      }

      first() {
        assert.fail("must not run");
      }

      second() {
        assert.fail("must not run");
      }
    }

    const summary = await drive(SkipFromBeforeEach);

    assert.equal(summary.failed, 0);
    assert.deepEqual(statuses(summary), ["first:dskip", "second:dskip"]);
    assert.equal(summary.specs[0].reason, "nothing to test today");
  }

  async classSkipIsUselessAfterTheFact() {
    class SkipFromAfter extends Test() {
      works() {}

      after() {
        skipClass("too late");
      }
    }

    const summary = await drive(SkipFromAfter);

    assert.equal(summary.failed, 1);
    assert.ok(
      /cannot be used in a after hook/.test(
        String((summary.hooks.find((h) => h.status === "failed")as any).error.message),
      ),
    );
  }

  async usingSkipTestInsideAHookIsAMistake() {
    class SkipTestInAfterEach extends Test() {
      works() {}

      afterEach() {
        skipTest("wrong helper");
      }
    }

    const summary = await drive(SkipTestInAfterEach);

    assert.equal(summary.failed, 1);
    assert.ok(
      /skipClass/.test(
        String((summary.hooks.find((h) => h.status === "failed") as any).error.message),
      ),
    );
  }

  async retriesFromTheClassConfig() {
    let attempts = 0;

    class RetryingClass extends Test({ retries: 2 }) {
      unstable() {
        if (++attempts < 3) throw new Error("not yet");
      }
    }

    const summary = await drive(RetryingClass);

    assert.equal(summary.failed, 0);
    assert.equal(summary.flaky, 1);
    assert.equal(summary.specs[0].attempts, 3);
  }

  async retriesGiveUpEventually() {
    class AlwaysFailing extends Test({ retries: 1 }) {
      hopeless() {
        throw new Error("never works");
      }
    }

    const summary = await drive(AlwaysFailing);

    assert.equal(summary.failed, 1);
    assert.equal(summary.specs[0].attempts, 2);
    assert.equal(summary.specs[0].flaky, false);
  }

  async cleanUpFailuresAreReported() {
    class CleanUpFails extends Test() {
      works() {}

      cleanUp() {
        throw new Error("could not close");
      }
    }

    const summary = await drive(CleanUpFails);

    assert.equal(summary.passed, 1);
    assert.equal(summary.failed, 1);
  }

  async bailMarksTheRunAborted() {
    class BailingClass extends Test() {
      boom() {
        throw new Error("stop");
      }

      never() {
        assert.fail("must not run");
      }
    }

    const summary = await drive(BailingClass, { bail: true });

    assert.equal(summary.aborted, true);
    assert.deepEqual(statuses(summary), ["boom:failed", "never:blocked"]);
  }

  async dynamicTestsBringTheirWholeDependencyChain() {
    class ChainDeepest extends Test() {
      value = 0;

      set() {
        this.value = 7;
      }
    }

    class ChainDeep extends Test({
      dependencies: { deepest: () => ChainDeepest },
    }) {
      check() {
        // a dependency of a dependency still has to be wired up
        assert.equal((this as any).deepest.value, 7);
      }
    }

    class ChainMiddle extends Test({
      dependencies: { deep: () => ChainDeep },
    }) {
      check() {
        assert.ok((this as any).deep);
      }
    }

    class ChainTrigger extends Test() {
      adds() {
        addTest(() => ChainMiddle);
      }
    }

    const summary = await drive(ChainTrigger);

    assert.equal(summary.failed, 0);
    assert.deepEqual(
      summary.specs.map((spec) => spec.className).sort(),
      ["ChainDeep", "ChainDeepest", "ChainMiddle", "ChainTrigger"],
      "every class in the chain ran",
    );
  }

  async aNestedRunDoesNotStealFromItsNeighbour() {
    let nested: RunSummary | null = null;

    class NestedInner extends Test() {
      async slow() {
        await delay(60);
      }
    }

    class LateAddition extends Test() {
      arrivesLate() {}
    }

    // runs a whole nested suite while the class below is still going
    class HostsANestedRun extends Test() {
      async runsANestedSuite() {
        nested = await driveAll([NestedInner]);
      }
    }

    class AddsWhileTheNestedRunIsBusy extends Test() {
      async addsLate() {
        await delay(20);
        addTest(() => LateAddition);
      }
    }

    const summary = await driveAll(
      [HostsANestedRun, AddsWhileTheNestedRunIsBusy],
      { concurrency: 2 },
    );

    const classes = summary.specs.map((spec) => spec.className);

    assert.equal(summary.failed, 0);
    assert.ok(
      classes.includes("LateAddition"),
      `the outer run has to pick the late test up, got ${classes.join(", ")}`,
    );
    assert.deepEqual(
      (nested as unknown as RunSummary)?.specs.map((spec) => spec.className),
      ["NestedInner"],
      "the nested run only ever sees its own classes",
    );
  }

  async classBailStopsTheClassOnly() {
    class StopsAtTheFirstFailure extends Test({ bail: true }) {
      boom() {
        throw new Error("stop here");
      }

      never() {
        assert.fail("must not run");
      }

      after() {
        trace.push("after ran");
      }

      cleanUp() {
        trace.push("cleanUp ran");
      }
    }

    class Neighbour extends Test() {
      works() {}
    }

    trace.length = 0;

    const summary = await driveAll([StopsAtTheFirstFailure, Neighbour]);

    assert.equal(summary.failed, 1);
    assert.deepEqual(statuses(summary), [
      "boom:failed",
      "never:blocked",
      "works:ok",
    ]);

    assert.equal(summary.aborted, false, "the run itself carries on");
    assert.deepEqual(
      trace,
      ["after ran", "cleanUp ran"],
      "the class is healthy, so its teardown still runs",
    );
  }

  async exclusiveClassesGetTheRunnerToThemselves() {
    const events: string[] = [];

    const noisy = (name: string) =>
      class extends Test() {
        async work() {
          events.push(`${name}:start`);
          await delay(40);
          events.push(`${name}:end`);
        }
      };

    class Alone extends Test({ exclusive: true }) {
      async work() {
        events.push("alone:start");
        await delay(30);
        events.push("alone:end");
      }
    }

    // the exclusive class comes last: the two before it may overlap, it may not
    await driveAll([noisy("first"), noisy("second"), Alone], {
      concurrency: 3,
    });

    const start = events.indexOf("alone:start");

    assert.equal(
      events[start + 1],
      "alone:end",
      `nothing may run next to an exclusive class: ${events.join(", ")}`,
    );

    // the others did overlap, so the run really was concurrent
    assert.ok(
      events.indexOf("second:start") < events.indexOf("first:end"),
      `the rest should still run in parallel: ${events.join(", ")}`,
    );
  }

  async grepExcludedClassesAreLeftAlone() {
    class ExcludedByGrep extends Test() {
      somethingElse() {
        assert.fail("must not run");
      }

      cleanUp() {
        trace.push("excluded cleanUp ran");
      }
    }

    trace.length = 0;

    const summary = await drive(ExcludedByGrep, { grep: "nothing-matches" });

    assert.equal(summary.filtered, 1);
    assert.equal(summary.passed, 0);
    assert.deepEqual(trace, [], "an excluded class never opened anything");
  }
}
