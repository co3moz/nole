import { Spec, Dependencies } from "../src/index.js";
import { strict as assert } from 'assert';

export class IOTPOTest {
  @Spec()
  async test() { }
}

@Dependencies([
  IOTPOTest
])
export class MultipleUppercasedCharsTest {
  @Spec()
  async check() {
    assert.notEqual(this['IOTPOTest'], undefined, 'turkish character test is failed');
  }
}

