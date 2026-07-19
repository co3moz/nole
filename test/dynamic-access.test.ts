import * as assert from "assert";
import { skipClass, Test, isSkipped } from "../dist/index";

class SomeRandomSkippedTest extends Test({}) {
  variable = 1;

  async iSkipItByeBye() {
    skipClass("nah");
  }

  async iShouldntBeExecuted() {
    this.variable = 2;
  }
}

export class NotSoRandomNotSkippedTest extends Test({
  dependencies: {
    forMeItIsImportant: () => SomeRandomSkippedTest,
  },
}) {
  variable = 0;
  async check() {
    this.variable = this.forMeItIsImportant.variable;
    assert.equal(this.variable, 1);
  }

  async ifMyDependencySkippedIShouldSkipToo() {
    if (isSkipped(this.forMeItIsImportant)) {
      skipClass("my bro skipped so i skip too");
    }

    this.variable = 2;
  }

  async shouldNotRun() {
    assert.equal(this.variable, 1);
  }
}
