import * as assert from 'assert';
import { Spec, Dependency } from "../src";
import { ManualRun } from "../src/run";
import { Hook, Skip } from "../src/decorators";
import { HookType } from "../src/test";

class BasicTest {
  @Spec()
  async thisTestsShouldNotFail() {
    for (let i = 0; i < 10; i++) this.testThis(i);
  }

  testThis(value: number) {
    assert.notEqual(value, 3);
  }
}

ManualRun().catch(x => {
  process.exit(1);
});


