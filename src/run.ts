import { HookType, TestWrap } from "./test-wrap.js";
import { BaseTest, type TestClassInfo } from "./core.js";
import { TEST_CLASS_KEY, TEST_INSTANCE_INFO } from "./symbol.js";
import { handleSpecs } from "./handle/specs.js";
import { handleCleanUp } from "./handle/cleanup-hooks.js";
import { runHooks } from "./handle/hooks.js";
import { colors, FAILED_TEXT } from "./const.js";
import {
  createMatcher,
  resolveOptions,
  type ResolvedOptions,
  type SpecMatcher,
} from "./config.js";
import { createReporter, type Reporter } from "./reporter/index.js";
import { summarize, type RunSummary } from "./results.js";
import type { RunContext } from "./context.js";
import { TimeDifference } from "./utils/time_difference.js";
import { AsyncLocalStorage } from "async_hooks";

let allTests: Map<new () => BaseTest, TestWrap> = new Map();
/** staging area for tests registered while no run is in progress */
let notTestedYet: Map<new () => BaseTest, TestWrap> = new Map();

interface RunScope {
  pending: Map<new () => BaseTest, TestWrap>;
  options: ResolvedOptions;
}

/**
 * Which run the code that is executing right now belongs to. This is async
 * local rather than a plain variable so that a run started from inside a spec
 * cannot claim the work of a sibling class running next to it.
 */
const scopeStorage = new AsyncLocalStorage<RunScope>();

const activeContexts = new Set<RunContext>();

export function createRunContext(
  init: {
    reporter?: Reporter;
    options?: ResolvedOptions;
  } = {},
): RunContext {
  const options = init.options ?? resolveOptions({});
  const reporter =
    init.reporter ??
    createReporter(options.reporter, (chunk) => process.stdout.write(chunk));

  return {
    reporter,
    options,
    specs: [],
    hooks: [],
    failed: false,
    aborted: false,
  };
}

/** Used by the signal handlers so an interrupted run still cleans up. */
export function abortActiveRuns() {
  for (const ctx of activeContexts) {
    ctx.aborted = true;
  }
}

export async function ManualRun(
  originalTests: Set<new () => BaseTest>,
  context?: RunContext,
): Promise<RunSummary> {
  const ctx = context ?? createRunContext();

  // A run owns its own queue. Anything registered through addTest() before the
  // run started is taken over here, so a nested run cannot steal the tests of
  // the run that is driving it.
  const pending = new Map<new () => BaseTest, TestWrap>();

  for (const [target, wrap] of notTestedYet) {
    if (!wrap.started) {
      pending.set(target, wrap);
    }
  }

  notTestedYet.clear();

  for (let test of originalTests) {
    wrapOf(test, pending);
  }

  extractInformationFromClasses(pending);

  if (!pending.size) {
    throw new Error("No specs found");
  }

  return scopeStorage.run({ pending, options: ctx.options }, () =>
    drain(ctx, pending),
  );
}

async function drain(
  ctx: RunContext,
  pending: Map<new () => BaseTest, TestWrap>,
): Promise<RunSummary> {
  applyFilter(ctx, pending);

  activeContexts.add(ctx);

  const started = TimeDifference.begin();
  /** only the classes this invocation drove, nested runs stay out of the way */
  const owned = new Set<TestWrap>();
  const running = new Map<TestWrap, Promise<void>>();
  /** a class marked exclusive is holding the lane on its own */
  let exclusive = false;

  try {
    while (pending.size || running.size) {
      let launched = false;

      // Classes queued by addTest() bring their own dependencies along, and
      // those may bring more. Resolving here keeps the graph complete no matter
      // when a class joined the queue.
      extractInformationFromClasses(pending);

      if (!ctx.aborted && !exclusive) {
        for (const entry of Array.from(pending.entries())) {
          if (running.size >= ctx.options.concurrency) break;

          const [target, test] = entry;

          if (test.started) {
            pending.delete(target);
            continue;
          }

          if (!test.dependencies.every((x) => x.dependency.isFinished)) {
            continue;
          }

          const alone = !!test.config.exclusive;

          // An exclusive class waits for the lane to empty, and nothing else
          // starts until it is done. Stopping the scan rather than skipping it
          // is what keeps it from being starved by its neighbours.
          if (alone && running.size) {
            break;
          }

          pending.delete(target);
          test.started = true;
          owned.add(test);
          launched = true;
          exclusive = alone;

          const promise = runOne(test, ctx).finally(() => {
            running.delete(test);

            if (alone) {
              exclusive = false;
            }
          });

          running.set(test, promise);

          if (alone) {
            break;
          }
        }
      }

      if (running.size) {
        await Promise.race(running.values());
        continue;
      }

      if (ctx.aborted) {
        break;
      }

      if (!launched && pending.size) {
        dependencyLock(pending);
      }
    }
  } finally {
    // Whatever happened above, everything that was instantiated gets a chance
    // to release its resources.
    await sweepCleanUp(ctx, owned);

    activeContexts.delete(ctx);
  }

  return summarize(ctx.specs, ctx.hooks, started.end(), ctx.aborted);
}

async function runOne(test: TestWrap, ctx: RunContext) {
  ctx.reporter.classStart(test.name);

  try {
    createInstanceIfNotExists(test);

    if (test.excluded) {
      // filtered out by --grep, only recorded so the counts add up
      await handleSpecs(test, ctx);
      return;
    }

    handleDependencies(test);

    if ((await runHooks(test, ctx, HookType.Before)) === "failed") {
      test.blocked = "before hook failed";
    }

    await handleSpecs(test, ctx);

    if (!test.blocked) {
      if ((await runHooks(test, ctx, HookType.After)) === "failed") {
        test.blocked = "after hook failed";
      }
    }
  } finally {
    test.isFinished = true;

    if (test.dependents.length == 0) {
      await handleCleanUp(test, ctx);
    }

    ctx.reporter.classEnd(test.name);
  }
}

/**
 * Runs the cleanup hooks of everything this run touched, dependents before
 * dependencies, no matter how the run ended.
 */
async function sweepCleanUp(ctx: RunContext, owned: Set<TestWrap>) {
  const pending = Array.from(owned).filter(
    (test) => test.testInstance && !test.cleanUpCalled,
  );

  while (pending.length) {
    const index = pending.findIndex((test) =>
      test.dependents.every(
        (dependent) => !dependent.testInstance || dependent.cleanUpCalled,
      ),
    );

    // A cycle would keep us here forever, so fall back to insertion order.
    const [next] = pending.splice(index === -1 ? 0 : index, 1);

    await handleCleanUp(next, ctx, true);

    for (let i = pending.length - 1; i >= 0; i--) {
      if (pending[i].cleanUpCalled) {
        pending.splice(i, 1);
      }
    }
  }
}

/**
 * --grep keeps the classes that own a matching spec plus everything they depend
 * on, because a dependency is what sets the state the matched spec needs.
 */
function applyFilter(
  ctx: RunContext,
  pending: Map<new () => BaseTest, TestWrap>,
) {
  const matcher = createMatcher(ctx.options.grep);

  if (!matcher) {
    return;
  }

  // spec names are only known once an instance exists
  for (const test of pending.values()) {
    createInstanceIfNotExists(test);
  }

  const keep = new Set<TestWrap>();

  for (const test of pending.values()) {
    if (hasMatch(test, matcher)) {
      collectDependencies(test, keep);
    }
  }

  for (const test of pending.values()) {
    if (!keep.has(test)) {
      test.excluded = true;

      for (const propertyKey of test.specs.keys()) {
        test.filtered.add(propertyKey);
      }

      continue;
    }

    if (!hasMatch(test, matcher)) {
      // kept only because something else needs it, so it runs in full
      continue;
    }

    for (const propertyKey of test.specs.keys()) {
      if (!matcher(test.name, propertyKey)) {
        test.filtered.add(propertyKey);
      }
    }
  }
}

function hasMatch(test: TestWrap, matcher: SpecMatcher) {
  for (const propertyKey of test.specs.keys()) {
    if (matcher(test.name, propertyKey)) {
      return true;
    }
  }

  return false;
}

function collectDependencies(test: TestWrap, into: Set<TestWrap>) {
  if (into.has(test)) {
    return;
  }

  into.add(test);

  for (const dependency of test.dependencies) {
    collectDependencies(dependency.dependency, into);
  }
}

function extractInformationFromClasses(
  tests: Map<new () => BaseTest, TestWrap>,
) {
  for (let [target, test] of tests.entries()) {
    updateInformationForClass(target, test, tests);
  }
}

export function updateInformationForClass(
  target: new () => BaseTest,
  test: TestWrap,
  tests: Map<new () => BaseTest, TestWrap>,
) {
  // Running this twice would duplicate the dependency edges, and a test can
  // reach this both through addTest() and through the run that picks it up.
  if (test.extracted) {
    return;
  }

  test.extracted = true;

  const config = (target as typeof BaseTest)[TEST_CLASS_KEY] as TestClassInfo;

  if (config.skip) {
    test.skipClass = { reason: config.skip };
  }

  test.dependencies = config.dependencies
    ? Array.from(config.dependencies.entries()).map(([key, dep]) => {
        const testWrap = wrapOf(dep(), tests);

        testWrap.dependents.push(test);

        return {
          propertyKey: key,
          dependency: testWrap,
        };
      })
    : [];

  if (config.before) {
    const beforeTests = config.before();

    for (let i = 0; i < beforeTests.length; i++) {
      const testWrap = wrapOf(beforeTests[i], tests);

      testWrap.dependencies.push({
        propertyKey: "_before_" + i,
        dependency: test,
      });

      test.dependents.push(testWrap);
    }
  }

  if (config.after) {
    const afterTests = config.after();

    for (let i = 0; i < afterTests.length; i++) {
      const testWrap = wrapOf(afterTests[i], tests);

      test.dependencies.push({
        propertyKey: "_after_" + i,
        dependency: testWrap,
      });

      testWrap.dependents.push(test);
    }
  }
}

/**
 * Looks a class up in the registry and, when it still has to run, queues it.
 * The registry and the queue are separate on purpose: a class that is already
 * running must be reused, never scheduled a second time.
 */
function wrapOf(
  target: new () => BaseTest,
  queue: Map<new () => BaseTest, TestWrap>,
): TestWrap {
  let wrap = allTests.get(target);

  if (!wrap) {
    wrap = new TestWrap(target);
    allTests.set(target, wrap);
  }

  if (!wrap.started && !queue.has(target)) {
    queue.set(target, wrap);
  }

  return wrap;
}

export function createInstanceIfNotExists(test: TestWrap) {
  if (!test.testInstance) {
    const instance = new test.target();

    instance[TEST_INSTANCE_INFO] = test;

    test.testInstance = instance;
  }

  if (!test.specDetection) {
    specDetection(test);
    test.specDetection = true;
  }
}

function specDetection(test: TestWrap) {
  const instance = test.testInstance;
  const prefix =
    scopeStorage.getStore()?.options.specSkipPrefix ??
    process.env.SPEC_SKIP_PREFIX ??
    "_";

  for (let key of getAllMethods(instance)) {
    if (typeof key !== "string") {
      continue;
    }

    if (key.startsWith(prefix)) {
      continue;
    }

    let lowerKey = key.toLowerCase();

    if (lowerKey.startsWith("skip")) {
      test.skip.set(key, { reason: "marked as skipped" });
    }

    if (
      lowerKey.startsWith("hook") ||
      lowerKey === "cleanup" ||
      lowerKey === "before" ||
      lowerKey === "after" ||
      lowerKey === "beforeeach" ||
      lowerKey === "aftereach"
    ) {
      let type = HookType.Before;

      if (lowerKey.endsWith("before")) {
        type = HookType.Before;
      } else if (lowerKey.endsWith("after")) {
        type = HookType.After;
      } else if (lowerKey.endsWith("beforeeach")) {
        type = HookType.BeforeEach;
      } else if (lowerKey.endsWith("aftereach")) {
        type = HookType.AfterEach;
      } else if (lowerKey.endsWith("cleanup")) {
        type = HookType.CleanUp;
      }

      test.hooks.set(key, { type });
      continue;
    }

    test.specs.set(key, {});
  }
}

function getAllMethods(instance: any): string[] {
  let props = new Set<string>();
  let currentObj = instance;
  let stack: any[] = [];

  while (currentObj && currentObj !== Object.prototype) {
    stack.push(currentObj);
    currentObj = Object.getPrototypeOf(currentObj);
  }
  while (stack.length > 0) {
    let obj = stack.pop(); // En üstteki (A.prototype) ilk çıkar
    Object.getOwnPropertyNames(obj).forEach((prop) => {
      if (typeof obj[prop] === "function" && prop !== "constructor") {
        props.add(prop);
      }
    });
  }

  return Array.from(props);
}

function handleDependencies(test: TestWrap) {
  for (let dependency of test.dependencies) {
    test.testInstance[dependency.propertyKey] =
      dependency.dependency.testInstance;
  }
}

function dependencyLock(tests: Map<new () => BaseTest, TestWrap>) {
  console.error(
    FAILED_TEXT +
      colors.red("Looks like there is confict issue for dependency resolving!"),
  );

  console.error("Possible conflicts;");
  for (let [, test] of tests) {
    console.error(
      `- class ${test.name} { ${test.dependencies
        .filter((x) => !x.dependency.isFinished)
        .map((x) => `@Dependency(${x.dependency.name}) ${x.propertyKey}`)
        .join(", ")} }`,
    );
  }

  throw new Error("Dependency lock occurred!");
}

export function getTestMap() {
  return allTests;
}

/**
 * Where a freshly added test should land: the running queue when a run is in
 * progress, otherwise the staging area the next run takes over.
 */
export function getFutureTestMap() {
  return scopeStorage.getStore()?.pending ?? notTestedYet;
}
