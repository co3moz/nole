import { HashMap } from "./data.js";
import { TimeDifference } from "./utils/time_difference.js";
import { TimeFactor } from "./utils/time_factor.js";
import * as clrs from "colors/safe.js";
import { Executor } from "./utils/executor.js";
import { HookType, Test } from "./test.js";

const colors = (clrs as any).default;

const OK_TEXT = colors.bold(colors.green("   (ok)   "));
const SKIP_TEXT = colors.bold(colors.yellow("  (skip)  "));
const DYNAMIC_SKIP_TEXT = colors.bold(colors.blue(" (dskip)   "));
const FAILED_TEXT = colors.bold(colors.red(" (failed) "));
const HOOK_FAILED_TEXT = colors.bold(colors.red(" (hook failed) "));

interface Options {
  log: Function;
  orderDebug: boolean;
}

export function ManualRun(options: Options) {
  if (!options.log) {
    options.log = console.log.bind(console);
  }

  const log = options.log;

  return new Promise<void>(async (resolve, reject) => {
    try {
      let hashMap = new Map(HashMap());

      if (!hashMap.size) {
        log(`${FAILED_TEXT} no specs found`);
        throw new Error("No specs found");
      }

      while (hashMap.size) {
        let test = PickNextTestFromHashMap(hashMap);

        if (test) {
          hashMap.delete(test.target);
          CreateInstanceIfNotExists(test);
          HandleDependencies(test);

          await HandleBeforeHooks(test, options);
          await HandleSpecs(test, options);
          await HandleAfterHooks(test, options);

          test.isFinished = true;

          if (test.dependents.length == 0) {
            await HandleCleanUp(test, options);
          }
        } else {
          DependencyLock(hashMap);
        }
      }

      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

function PickNextTestFromHashMap(hashMap: Map<any, Test>) {
  for (let test of hashMap.values()) {
    if (test.isFinished) continue;
    if (!test.dependencies.every((x) => x.dependency.isFinished)) continue;

    return test;
  }
}

function CreateInstanceIfNotExists(test: Test) {
  if (!test.testInstance) {
    test.testInstance = new test.target();
  }
}

function HandleDependencies(test: Test) {
  for (let dependency of test.dependencies) {
    test.testInstance[dependency.propertyKey] =
      dependency.dependency.testInstance;
  }
}

async function HandleBeforeHooks(test: Test, options: Options) {
  for (let [propertyKey, hook] of test.hooks.entries()) {
    if (hook.type != HookType.Before) continue;

    let hookName = colors.bold(
      colors.yellow(
        test.name +
          (propertyKey != "before" ? `.${propertyKey}:before` : ":before")
      )
    );

    try {
      if (!options.orderDebug) {
        await Executor(
          test.testInstance[propertyKey].bind(test.testInstance),
          hook.timeout
        );
      } else {
        let timeText = TimeFactor(0, hook.timeout);

        options.log(`${OK_TEXT} ${timeText} ${hookName}()`);
      }
    } catch (e) {
      console.error(`${HOOK_FAILED_TEXT} ${hookName}()`);
      console.error((e as any)?.stack ?? e);
      throw e;
    }
  }
}

async function HandleBeforeEachHooks(test: Test, options: Options) {
  for (let [propertyKey, hook] of test.hooks.entries()) {
    if (hook.type != HookType.BeforeEach) continue;
    let hookName = colors.bold(
      colors.yellow(
        test.name +
          (propertyKey != "beforeEach"
            ? `.${propertyKey}:beforeEach`
            : ":beforeEach")
      )
    );

    try {
      if (!options.orderDebug) {
        await Executor(
          test.testInstance[propertyKey].bind(test.testInstance),
          hook.timeout
        );
      } else {
        let timeText = TimeFactor(0, hook.timeout);

        options.log(`${OK_TEXT} ${timeText} ${hookName}()`);
      }
    } catch (e) {
      console.error(`${HOOK_FAILED_TEXT} ${hookName}()`);
      console.error((e as any)?.stack ?? e);
      throw e;
    }
  }
}

async function HandleAfterEachHooks(test: Test, options: Options) {
  for (let [propertyKey, hook] of test.hooks.entries()) {
    if (hook.type != HookType.AfterEach) continue;

    let hookName = colors.bold(
      colors.yellow(
        test.name +
          (propertyKey != "afterEach"
            ? `.${propertyKey}:afterEach`
            : ":afterEach")
      )
    );

    try {
      if (!options.orderDebug) {
        await Executor(
          test.testInstance[propertyKey].bind(test.testInstance),
          hook.timeout
        );
      } else {
        let timeText = TimeFactor(0, hook.timeout);

        options.log(`${OK_TEXT} ${timeText} ${hookName}()`);
      }
    } catch (e) {
      console.error(`${HOOK_FAILED_TEXT} ${hookName}()`);
      console.error((e as any)?.stack ?? e);
      throw e;
    }
  }
}

async function HandleSpecs(test: Test, options: Options) {
  const log = options.log;

  for (let [propertyKey, spec] of test.specs.entries()) {
    let testName = colors.bold(colors.yellow(test.name + "." + propertyKey));

    const shouldPropertySkip = test.skip.has(propertyKey);
    if (shouldPropertySkip || test.skipClass) {
      let reason = shouldPropertySkip
        ? test.skip.get(propertyKey)!.reason
        : test.skipClass!.reason;
      log(
        `${SKIP_TEXT} ${" ".repeat(9)} ${testName}() ${
          reason ? "{" + reason + "}" : ""
        }`
      );
      continue;
    }

    await HandleBeforeEachHooks(test, options);

    let start = TimeDifference.begin();

    try {
      if (!options.orderDebug) {
        await Executor(
          test.testInstance[propertyKey].bind(test.testInstance),
          spec.timeout
        );
      }

      let timeText = TimeFactor(start.end(), spec.timeout);

      log(`${OK_TEXT} ${timeText} ${testName}()`);
    } catch (e) {
      if ((e as any)?._nole_anchor) {
        let reason = (e as any).reason;
        log(
          `${DYNAMIC_SKIP_TEXT} ${" ".repeat(8)} ${testName}() ${
            reason ? "{" + reason + "}" : ""
          }`
        );
        continue;
      }

      let timeText = TimeFactor(start.end(), spec.timeout);

      console.error(`${FAILED_TEXT} ${timeText} ${testName}()`);
      console.error((e as any)?.stack ?? e);
      throw e;
    }

    await HandleAfterEachHooks(test, options);
  }
}

async function HandleAfterHooks(test: Test, options: Options) {
  for (let [propertyKey, hook] of test.hooks.entries()) {
    if (hook.type != HookType.After) continue;

    let hookName = colors.bold(
      colors.yellow(
        test.name +
          (propertyKey != "after" ? `.${propertyKey}:after` : ":after")
      )
    );

    try {
      if (!options.orderDebug) {
        await Executor(
          test.testInstance[propertyKey].bind(test.testInstance),
          hook.timeout
        );
      } else {
        let timeText = TimeFactor(0, hook.timeout);

        options.log(`${OK_TEXT} ${timeText} ${hookName}()`);
      }
    } catch (e) {
      console.error(`${HOOK_FAILED_TEXT} ${hookName}()`);
      console.error((e as any)?.stack ?? e);
      throw e;
    }
  }
}

async function HandleCleanUp(test: Test, options: Options) {
  if (test.cleanUpCalled) return;
  if (
    !test.dependents.every(
      (dependent) => dependent.isFinished && dependent.cleanUpCalled
    )
  )
    return;

  test.cleanUpCalled = true;

  const log = options.log;

  for (let [propertyKey, hook] of test.hooks.entries()) {
    if (hook.type != HookType.CleanUp) continue;

    let hookName = colors.bold(
      colors.yellow(
        test.name +
          (propertyKey != "cleanUp" ? `.${propertyKey}:cleanUp` : ":cleanUp")
      )
    );
    let start = TimeDifference.begin();

    try {
      if (!options.orderDebug) {
        await Executor(
          test.testInstance[propertyKey].bind(test.testInstance),
          hook.timeout
        );
      }

      let timeText = TimeFactor(start.end(), hook.timeout);

      log(`${OK_TEXT} ${timeText} ${hookName}()`);
    } catch (e) {
      console.error(`${HOOK_FAILED_TEXT} ${hookName}()`);
      console.error((e as any)?.stack ?? e);
      throw e;
    }
  }

  for (let tree of test.dependencies) {
    await HandleCleanUp(tree.dependency, options);
  }
}

function DependencyLock(hashMap: Map<any, Test>) {
  console.error(
    FAILED_TEXT +
      colors.red("Looks like there is confict issue for dependency resolving!")
  );

  console.error("Possible conflicts;");
  for (let test of hashMap.values()) {
    console.error(
      `- class ${test.name} { ${test.dependencies
        .filter((x) => !x.dependency.isFinished)
        .map((x) => `@Dependency(${x.dependency.name}) ${x.propertyKey}`)
        .join(", ")} }`
    );
  }

  throw new Error("Dependency lock occurred!");
}
