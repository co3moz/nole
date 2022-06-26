import { HashMap } from "./data.js";
import { TimeDifference } from "./utils/time_difference.js";
import { TimeFactor } from "./utils/time_factor.js";
import * as clrs from 'colors/safe.js';
import { Executor } from "./utils/executor.js";
import { HookType, Test } from "./test.js";

const colors = (clrs as any).default;

const OK_TEXT = colors.bold(colors.green('   (ok)   '));
const SKIP_TEXT = colors.bold(colors.yellow('  (skip)  '));
const DYNAMIC_SKIP_TEXT = colors.bold(colors.blue(' (dskip)   '));
const FAILED_TEXT = colors.bold(colors.red(' (failed) '));
const HOOK_FAILED_TEXT = colors.bold(colors.red(' (hook failed) '));

export function ManualRun(log: Function) {
  if (!log) {
    log = console.log.bind(console);
  }

  return new Promise<void>(async (resolve, reject) => {
    try {
      let hashMap = new Map(HashMap());

      if (!hashMap.size) {
        log(`${FAILED_TEXT} no specs found`);
        throw new Error('No specs found');
      }

      while (hashMap.size) {
        let test = PickNextTestFromHashMap(hashMap);

        if (test) {
          hashMap.delete(test.target);
          CreateInstanceIfNotExists(test);
          HandleDependencies(test);

          await HandleBeforeHooks(test);
          await HandleSpecs(test, log);
          await HandleAfterHooks(test);

          test.isFinished = true;
          
          if (test.dependents.length == 0) {
            await HandleCleanUp(test, log);
          }
          
          test.isFullyFinished = true;
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
    if (!test.dependencies.every(x => x.dependency.isFinished)) continue;

    return test;
  }
}

function CreateInstanceIfNotExists(test: Test) {
  if (!test.testInstance) {
    test.testInstance = new (test.target);
  }
}

function HandleDependencies(test: Test) {
  for (let dependency of test.dependencies) {
    test.testInstance[dependency.propertyKey] = dependency.dependency.testInstance;
  }
}

async function HandleBeforeHooks(test: Test) {
  for (let [propertyKey, hook] of test.hooks.entries()) {
    if (hook.type != HookType.Before) continue;

    try {
      await Executor(test.testInstance[propertyKey].bind(test.testInstance), hook.timeout);

    } catch (e) {
      let hookName = colors.bold(colors.yellow(test.name + (propertyKey != 'before' ? `.${propertyKey}:before` : ':before')));

      console.error(`${HOOK_FAILED_TEXT} ${hookName}()`);
      console.error((e as any)?.stack ?? e);
      throw e;
    }
  }
}

async function HandleBeforeEachHooks(test: Test) {
  for (let [propertyKey, hook] of test.hooks.entries()) {
    if (hook.type != HookType.BeforeEach) continue;
    try {
      await Executor(test.testInstance[propertyKey].bind(test.testInstance), hook.timeout);

    } catch (e) {
      let hookName = colors.bold(colors.yellow(test.name + (propertyKey != 'beforeEach' ? `.${propertyKey}:beforeEach` : ':beforeEach')));

      console.error(`${HOOK_FAILED_TEXT} ${hookName}()`);
      console.error((e as any)?.stack ?? e);
      throw e;
    }
  }
}

async function HandleAfterEachHooks(test: Test) {
  for (let [propertyKey, hook] of test.hooks.entries()) {
    if (hook.type != HookType.AfterEach) continue;
    try {
      await Executor(test.testInstance[propertyKey].bind(test.testInstance), hook.timeout);

    } catch (e) {
      let hookName = colors.bold(colors.yellow(test.name + (propertyKey != 'afterEach' ? `.${propertyKey}:afterEach` : ':afterEach')));

      console.error(`${HOOK_FAILED_TEXT} ${hookName}()`);
      console.error((e as any)?.stack ?? e);
      throw e;
    }
  }
}

async function HandleSpecs(test: Test, log: Function) {
  for (let [propertyKey, spec] of test.specs.entries()) {
    let testName = colors.bold(colors.yellow(test.name + '.' + propertyKey));

    const shouldPropertySkip = test.skip.has(propertyKey);
    if (shouldPropertySkip || test.skipClass) {
      let reason = shouldPropertySkip ? test.skip.get(propertyKey)!.reason : test.skipClass!.reason;
      log(`${SKIP_TEXT} ${' '.repeat(9)} ${testName}() ${reason ? '{' + reason + '}' : ''}`);
      continue;
    }

    await HandleBeforeEachHooks(test);

    let start = TimeDifference.begin();

    try {
      await Executor(test.testInstance[propertyKey].bind(test.testInstance), spec.timeout);

      let timeText = TimeFactor(start.end(), spec.timeout);

      log(`${OK_TEXT} ${timeText} ${testName}()`);
    } catch (e) {
      if ((e as any)?._nole_anchor) {
        let reason = (e as any).reason;
        log(`${DYNAMIC_SKIP_TEXT} ${' '.repeat(8)} ${testName}() ${reason ? '{' + reason + '}' : ''}`);
        continue;
      }

      let timeText = TimeFactor(start.end(), spec.timeout);

      console.error(`${FAILED_TEXT} ${timeText} ${testName}()`);
      console.error((e as any)?.stack ?? e);
      throw e;
    }

    await HandleAfterEachHooks(test);
  }
}

async function HandleAfterHooks(test: Test) {
  for (let [propertyKey, hook] of test.hooks.entries()) {
    if (hook.type != HookType.After) continue;
    try {
      await Executor(test.testInstance[propertyKey].bind(test.testInstance), hook.timeout);

    } catch (e) {
      let hookName = colors.bold(colors.yellow(test.name + (propertyKey != 'after' ? `.${propertyKey}:after` : ':after')));

      console.error(`${HOOK_FAILED_TEXT} ${hookName}()`);
      console.error((e as any)?.stack ?? e);
      throw e;
    }
  }
}


async function HandleCleanUp(test: Test, log: Function) {
  if (test.cleanUpCalled) return;
  if (!test.dependents.every(dependent => dependent.isFinished)) return;

  test.cleanUpCalled = true;

  for (let [propertyKey, hook] of test.hooks.entries()) {
    if (hook.type != HookType.CleanUp) continue;
    
    let hookName = colors.bold(colors.yellow(test.name + (propertyKey != 'cleanUp' ? `.${propertyKey}:cleanUp` : ':cleanUp')));
    let start = TimeDifference.begin();

    try {
      await Executor(test.testInstance[propertyKey].bind(test.testInstance), hook.timeout);

      let timeText = TimeFactor(start.end(), hook.timeout);

      log(`${OK_TEXT} ${timeText} ${hookName}()`);
    } catch (e) {
      console.error(`${HOOK_FAILED_TEXT} ${hookName}()`);
      console.error((e as any)?.stack ?? e);
      throw e;
    }
  }

  for (let tree of test.dependencies) {
    await HandleCleanUp(tree.dependency, log);
  }
}

function DependencyLock(hashMap: Map<any, Test>) {
  console.error(FAILED_TEXT + colors.red('Looks like there is confict issue for dependency resolving!'));

  console.error('Possible conflicts;');
  for (let test of hashMap.values()) {

    console.error(`- class ${test.name} { ${test.dependencies.filter(x => !x.dependency.isFinished).map(x => `@Dependency(${x.dependency.name}) ${x.propertyKey}`).join(', ')} }`);
  }

  throw new Error('Dependency lock occurred!');
}