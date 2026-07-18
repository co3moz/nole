import { HookType, TestWrap } from "./test-wrap.js";
import { BaseTest, type TestClassInfo } from "./core.js";
import { TEST_CLASS_KEY } from "./symbol.js";
import { handleBeforeHooks } from "./handle/before-hooks.js";
import { handleSpecs } from "./handle/specs.js";
import { handleAfterHooks } from "./handle/after-hooks.js";
import { handleCleanUp } from "./handle/cleanup-hooks.js";
import { colors, FAILED_TEXT } from "./const.js";

let allTests: Map<new () => BaseTest, TestWrap> = new Map();
let notTestedYet: Map<new () => BaseTest, TestWrap> = new Map();

export async function ManualRun(originalTests: Set<new () => BaseTest>) {
  for (let test of originalTests) {
    if (allTests.has(test)) {
      continue;
    }

    const wrap = new TestWrap(test);

    allTests.set(test, wrap);
    notTestedYet.set(test, wrap);
  }

  extractInformationFromClasses(notTestedYet);

  if (!notTestedYet.size) {
    throw new Error("No specs found");
  }

  while (notTestedYet.size) {
    let entry = pickNext(notTestedYet);

    if (entry) {
      let test = entry[1];
      // console.log(colors.bold(colors.cyan(`Running test: ${test.name}`)));

      notTestedYet.delete(test.target);
      createInstanceIfNotExists(test);
      handleDependencies(test);

      await handleBeforeHooks(test);
      await handleSpecs(test);
      await handleAfterHooks(test);

      test.isFinished = true;

      if (test.dependents.length == 0) {
        await handleCleanUp(test);
      }
    } else {
      dependencyLock(notTestedYet);
    }
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
  const config = (target as typeof BaseTest)[TEST_CLASS_KEY] as TestClassInfo;

  if (config.skip) {
    test.skipClass = { reason: config.skip };
  }

  test.dependencies = config.dependencies
    ? Array.from(
        config.dependencies.entries().map(([key, dep]) => {
          const actual = dep();
          let testWrap = tests.get(actual);

          if (!testWrap) {
            testWrap = new TestWrap(actual);
            tests.set(actual, testWrap);
            allTests.set(actual, testWrap);
          }

          testWrap.dependents.push(test);

          return {
            propertyKey: key,
            dependency: testWrap,
          };
        }),
      )
    : [];

  if (config.before) {
    const beforeTests = config.before();

    for (let i = 0; i < beforeTests.length; i++) {
      const actual = beforeTests[i];

      let testWrap = tests.get(actual);

      if (!testWrap) {
        testWrap = new TestWrap(actual);
        tests.set(actual, testWrap);
        allTests.set(actual, testWrap);
      }

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
      const actual = afterTests[i];

      let testWrap = tests.get(actual);

      if (!testWrap) {
        testWrap = new TestWrap(actual);
        tests.set(actual, testWrap);
        allTests.set(actual, testWrap);
      }

      test.dependencies.push({
        propertyKey: "_after_" + i,
        dependency: testWrap,
      });

      testWrap.dependents.push(test);
    }
  }
}

function pickNext(tests: Map<new () => BaseTest, TestWrap>) {
  for (let entry of tests.entries()) {
    let test = entry[1];
    if (test.isFinished) continue;
    if (!test.dependencies.every((x) => x.dependency.isFinished)) continue;

    return entry;
  }
}

export function createInstanceIfNotExists(test: TestWrap) {
  if (!test.testInstance) {
    const instance = new test.target();

    test.testInstance = instance;
  }

  if (!test.specDetection) {
    specDetection(test);
    test.specDetection = true;
  }
}

function specDetection(test: TestWrap) {
  const instance = test.testInstance;
  for (let key of getAllMethods(instance)) {
    if (typeof key !== "string") {
      continue;
    }

    if (key.startsWith(process.env.SPEC_SKIP_PREFIX ?? "_")) {
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

export function getFutureTestMap() {
  return notTestedYet;
}
