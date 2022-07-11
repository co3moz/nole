import { Spec, Dependencies } from "../src/index.js";
import { strict as assert } from 'assert';

export class ICharacterTest {
  @Spec()
  async test() { }
}

@Dependencies([
  ICharacterTest
])
export class TurkishCharacterTest {
  @Spec()
  async check() {
    assert.notEqual(this['iCharacterTest'], undefined, 'turkish character test is failed');
  }
}

