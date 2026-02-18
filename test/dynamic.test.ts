import * as assert from "assert";
import { addTest } from "../dist/dynamic";
import { Test } from "../dist/index";

class DynamicTest extends Test() {
  variable = 1;

  async test() {
    const v = (this.variable = Math.random());

    addTest(
      () =>
        class UltraDynamic extends Test({
          dependencies: { dynamicTest: () => DynamicTest },
        }) {
          async test() {
            assert.equal(
              this.dynamicTest.variable,
              v,
              "The dynamic test variable should be the same as the one in the parent test",
            );
          }
        },
    );
  }
}

addTest(() => DynamicTest);
