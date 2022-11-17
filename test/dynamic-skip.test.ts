import { skipTest, Spec } from "../src/index.js";

export class DynamicSkipTest {
  @Spec()
  async thisShouldBeSkipped() {
    skipTest("I don't like this test anymore!");
  }
}
