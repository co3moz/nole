import { skipTest, Spec } from "../src";

export class DynamicSkipTest {
  @Spec()
  async thisShouldBeSkipped() {
    skipTest('I don\'t like this test anymore!');
  }
}
