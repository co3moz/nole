import { HashMap } from "./data";
import { TimeDifference } from "./utils/time_difference";
import { TimeFactor } from "./utils/time_factor";
import * as colors from 'colors/safe';
import { Executor } from "./utils/executor";
import { HookType, Test } from "./test";

const OK_TEXT = colors.bold(colors.green('   (ok)   '));
const SKIP_TEXT = colors.bold(colors.yellow('  (skip)  '));
const FAILED_TEXT = colors.bold(colors.red(' (failed) '));
const HOOK_FAILED_TEXT = colors.bold(colors.red(' (hook failed) '));

export function ManualRun() {
  return new Promise((resolve, reject) => {
    setTimeout(async function () {
      try {
        while (HashMap.size) {
          let test = PickNextTestFromHashMap();
          if (test) {
            HashMap.delete(test.target);
            CreateInstanceIfNotExists(test);
            HandleDependencies(test);

            await HandleBeforeHooks(test);
            await HandleSpecs(test);
            await HandleAfterHooks(test);

            test.isFinished = true;
          } else {
            DependencyLock();
          }
        }

        resolve();
      } catch (e) {
        reject(e);
      }
    }, 1);
  });
}

function PickNextTestFromHashMap() {
  for (let bigaTest of HashMap.values()) {
    if (bigaTest.isFinished) continue;
    if (!bigaTest.dependencies.every(x => x.dependency.isFinished)) continue;

    return bigaTest;
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
      console.error(e);
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
      console.error(e);
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
      console.error(e);
      throw e;
    }
  }
}

async function HandleSpecs(test: Test) {
  for (let [propertyKey, spec] of test.specs.entries()) {
    let testName = colors.bold(colors.yellow(test.name + '.' + propertyKey));

    if (test.skip.has(propertyKey)) {
      let reason = test.skip.get(propertyKey)!.reason;
      console.log(`${SKIP_TEXT} ${' '.repeat(9)} ${testName}() ${reason ? '{' + reason + '}' : ''}`);
      continue;
    }

    await HandleBeforeEachHooks(test);

    let start = TimeDifference.begin();

    try {
      await Executor(test.testInstance[propertyKey].bind(test.testInstance), spec.timeout);

      let timeText = TimeFactor(start.end(), spec.timeout);

      console.log(`${OK_TEXT} ${timeText} ${testName}()`);
    } catch (e) {
      let timeText = TimeFactor(start.end(), spec.timeout);

      console.error(`${FAILED_TEXT} ${timeText} ${testName}()`);
      console.error(e);
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
      console.error(e);
      throw e;
    }
  }
}

function DependencyLock() {
  console.error(FAILED_TEXT + colors.red('Looks like there is confict issue for dependency resolving!'));

  console.error('Possible conflicts;');
  for (let bigaTest of HashMap.values()) {

    console.error(`- class ${bigaTest.name} { ${bigaTest.dependencies.filter(x => !x.dependency.isFinished).map(x => `@Dependency(${x.dependency.name}) ${x.propertyKey}`).join(', ')} }`);
  }

  throw new Error('Dependency lock occurred!');
}