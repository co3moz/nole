import { Test, skipTest, skipClass } from "../dist/index.js";
export class DynamicSkipTest extends Test() {
  async thisShouldBeSkipped() {
    skipTest("I don't like this test anymore!");
  }
}

export class DynamicSkipClassTest extends Test() {
  async thisShouldNotBeSkipped() {}

  async thisShouldBeSkipped() {
    skipClass("I don't like this test-class anymore!");
  }

  async alsoThisShouldBeSkipped() {}
}

export class ConditionalSkipTest extends Test() {
  async donotrun() {}

  async before() {
    skipClass();
  }
}
