import { Test, skipTest } from "../dist/index.js";
export class DynamicSkipTest extends Test() {
  async thisShouldBeSkipped() {
    skipTest("I don't like this test anymore!");
  }
}
