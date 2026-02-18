import * as assert from "assert";
import {
  CleanUpLayer1Test,
  CleanUpLayer2Test,
  CleanUpLayer3Test,
} from "./clean-up.test.js";
import { DynamicSkipTest } from "./dynamic-skip.test.js";
import { HookTest } from "./hook.test.js";
import { Test } from "../dist/index.js";
import { DependencyTest } from "./basic.test.js";

export class MultiLazyDependency extends Test({
  dependencies: {
    dependencyTest: () => DependencyTest,

    c1: () => CleanUpLayer1Test,
    c2: () => CleanUpLayer2Test,
    c3: () => CleanUpLayer3Test,
    c4: () => DynamicSkipTest,
    c5: () => HookTest,
    c6: () => MultiDependency,
  },
}) {
  test() {
    assert.strictEqual(this.dependencyTest.basicTest.variable, 1);
  }
}

export class MultiDependency extends Test({
  dependencies: {
    dependencyTest: () => DependencyTest,

    c1: () => CleanUpLayer1Test,
    c2: () => CleanUpLayer2Test,
    c3: () => CleanUpLayer3Test,
    c4: () => DynamicSkipTest,
    c5: () => HookTest,
  },
}) {
  test() {
    assert.strictEqual(this.dependencyTest.basicTest.variable, 1);
  }
}
