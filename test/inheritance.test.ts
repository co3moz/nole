import * as assert from "assert";
import { skipClass, Test } from "../dist/index";

export class GrandparentTest extends Test() {
  variable = 1;

  async doesSomething() {
    assert.equal(this.variable, 1);
    this.variable = 2;
  }
}

export class FatherTest extends GrandparentTest {
  async doesSomethingElse() {
    assert.equal(this.variable, 2);
    this.variable = 3;
  }
}

export class ChildTest extends FatherTest {
  async doesMoreStuff() {
    assert.equal(this.variable, 3);
    this.variable = 4;
  }
}

class CompanyTest extends Test() {
  async noWorkingAllowed() {
    skipClass("no working allowed");
  }
}

export class EmployeeTest extends CompanyTest {
  async work() {
    assert.fail("I should have been skipped");
  }
}

class HookInitialTest extends Test() {
  variable = 1;
  before() {
    this.variable = 2;
  }

  test() {
    assert.equal(this.variable, 2);
    this.variable = 3;
  }
}

export class HookOverrideTest extends HookInitialTest {
  before() {
    super.before();
    this.variable = 10;
  }

  test() {
    assert.equal(this.variable, 10);
  }
}
