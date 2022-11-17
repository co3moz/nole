import * as assert from "assert";
import { Dependencies, Spec } from "../src/index.js";
import { BasicTest } from "./basic.test.js";
import {
  CleanUpLayer1Test,
  CleanUpLayer2Test,
  CleanUpLayer3Test,
} from "./clean-up.test.js";
import { DynamicSkipTest } from "./dynamic-skip.test.js";
import { HookTest } from "./hook.test.js";

@Dependencies(() => [
  BasicTest,
  CleanUpLayer1Test,
  CleanUpLayer2Test,
  CleanUpLayer3Test,
  DynamicSkipTest,
  HookTest,
  MultiDependency,
])
export class MultiLazyDependency {
  basicTest: BasicTest;

  @Spec()
  test() {
    assert.strictEqual(this.basicTest.variable, 1);
  }
}

@Dependencies([
  BasicTest,
  CleanUpLayer1Test,
  CleanUpLayer2Test,
  CleanUpLayer3Test,
  DynamicSkipTest,
  HookTest,
])
export class MultiDependency {
  basicTest: BasicTest;

  @Spec()
  test() {
    assert.strictEqual(this.basicTest.variable, 1);
  }
}
