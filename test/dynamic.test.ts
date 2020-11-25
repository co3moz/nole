import * as assert from 'assert';
import { Spec } from "../src";

export class DynamicTest {
  @Spec()
  async thisTestsShouldNotFail() {
    for (let i = 0; i < 10; i++) this.testThis(i);
  }

  testThis(value: number) {
    assert.notEqual(value, 10);
  }
}
