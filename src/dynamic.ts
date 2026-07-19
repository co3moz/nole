import { BaseTest } from "./core.js";
import {
  createInstanceIfNotExists,
  getFutureTestMap,
  getTestMap,
  updateInformationForClass,
} from "./run.js";
import { TEST_CLASS_KEY, TEST_INSTANCE_INFO } from "./symbol.js";
import { TestWrap } from "./test-wrap.js";

export function skipTest(reason?: string): never {
  throw new NoleManualSkip(reason);
}

export function skipClass(reason?: string): never {
  throw new NoleManualClassSkip(reason);
}

export function isSkipped(instance: BaseTest) {
  const info = instance[TEST_INSTANCE_INFO];

  return !!info?.skip;
}

class NoleManualSkip extends Error {
  _nole_anchor = 1;

  constructor(public reason?: string) {
    super(`Dynamicly skipped! ${reason}`);
  }
}

class NoleManualClassSkip extends Error {
  _nole_anchor = 2;

  constructor(public reason?: string) {
    super(`Dynamicly skipped! ${reason}`);
  }
}

export function getTest<T extends BaseTest>(
  test: () => new () => T,
): Partial<T> | null {
  const testWrap = getTestMap().get(test() as any) as TestWrap | undefined;

  if (!testWrap) {
    return null;
  }

  createInstanceIfNotExists(testWrap);

  return testWrap.testInstance;
}

export function addTest<T extends BaseTest>(test: () => new () => T) {
  const testMap = getTestMap();
  const remainingTests = getFutureTestMap();

  const testClass = test();

  if (testMap.has(testClass)) {
    return false;
  }

  const testWrap = new TestWrap(testClass);
  remainingTests.set(testClass, testWrap);
  testMap.set(testClass, testWrap);

  updateInformationForClass(testClass, testWrap, testMap);

  return true;
}
