import * as assert from "assert";
import { Test } from "./index.js";
import { addTest, getTest, skipClass, skipTest } from "./dynamic.js";
import { ManualRun } from "./run.js";

// These classes are not exported, so the outer runner ignores them. They are
// driven directly through the src ManualRun pipeline below, which is what lets
// coverage reach run.ts, the hook handlers and specs.ts.

class Dependency extends Test() {
  ready = false;

  init() {
    this.ready = true;
  }

  cleanUp() {}
}

class Main extends Test({
  dependencies: {
    dep: () => Dependency,
    depDirect: Dependency as any, // covers the direct-class dependency branch
  },
}) {
  _internal() {
    assert.fail("internal methods should never run as specs");
  }

  skip_thisOne() {
    assert.fail("skip_ methods should never run");
  }

  hookInit() {}

  async before() {}
  async after() {}
  async beforeEach() {}
  async afterEach() {}

  usesDependency() {
    assert.equal((this as any).dep.ready, true);
    assert.equal((this as any).depDirect.ready, true);
  }

  cleanUp() {}
}

class OrderFirst extends Test() {
  step() {}
}

class OrderLast extends Test({ before: () => [OrderFirst] }) {
  step() {}
}

class AfterAnchor extends Test() {
  step() {}
}

class AfterDependent extends Test({ after: () => [AfterAnchor] }) {
  step() {}
}

class DynamicSkipClassFromSpec extends Test() {
  first() {
    skipClass("skipped from a spec");
  }

  second() {
    assert.fail("should have been class-skipped");
  }
}

class DynamicSkipClassFromBefore extends Test() {
  before() {
    skipClass("skipped from before");
  }

  spec() {
    assert.fail("should have been class-skipped");
  }
}

class DynamicSkipSingleSpec extends Test() {
  skipped() {
    skipTest("just this one");
  }

  kept() {}
}

class StaticallySkipped extends Test({ skip: "static skip" }) {
  spec() {
    assert.fail("should have been skipped");
  }
}

class Failing extends Test() {
  boom() {
    throw new Error("intentional failure");
  }
}

class SkipTestInBefore extends Test() {
  before() {
    skipTest("wrong helper");
  }

  spec() {}
}

export class PipelineTest extends Test() {
  async dynamicApi() {
    class NeverRegistered extends Test() {
      spec() {}
    }

    assert.equal(addTest(() => NeverRegistered), true);
    assert.equal(addTest(() => NeverRegistered), false); // duplicate

    const instance = getTest(() => NeverRegistered);
    assert.ok(instance);

    class Unknown extends Test() {}
    assert.equal(getTest(() => Unknown), null);

    assert.throws(
      () => skipTest("x"),
      (e: any) => e._nole_anchor === 1 && e.reason === "x",
    );
    assert.throws(
      () => skipClass("y"),
      (e: any) => e._nole_anchor === 2 && e.reason === "y",
    );
  }

  async drivesTheWholePipeline() {
    await ManualRun(
      new Set<any>([
        Main,
        OrderFirst,
        OrderLast,
        AfterAnchor,
        AfterDependent,
        DynamicSkipClassFromSpec,
        DynamicSkipClassFromBefore,
        DynamicSkipSingleSpec,
        StaticallySkipped,
      ]),
    );

    // a throwing spec propagates out of the pipeline
    await assert.rejects(() => ManualRun(new Set<any>([Failing])));

    // skipTest inside a before hook is a usage error
    await assert.rejects(() => ManualRun(new Set<any>([SkipTestInBefore])));
  }
}
