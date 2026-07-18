import * as assert from "assert";
import { Test } from "../dist/index";

export class InternalTest extends Test() {
  variable = 1;

  async start() {
    assert.equal(this.variable, 1);
    this.variable = 2;
  }

  async _internalFunction() {
    assert.equal(this.variable, 1);
    this.variable = 3;
  }

  async afterInternalFunction() {
    assert.equal(this.variable, 2);
    this.variable = 3;
  }
}
