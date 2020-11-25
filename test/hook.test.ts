import * as assert from 'assert';
import { Spec, Hook, Skip, HookType } from "../src";

export class BasicTest {
  array: any[] = [1, 2, 3];

  @Hook(HookType.BeforeEach)
  async beforeEach() {
    this.array.push(4);
  }

  @Spec()
  async hasToBe4() {
    assert.equal(this.array.pop(), 4);
  }

  @Skip('no need')
  @Spec()
  async hasToBe4Again() {
    assert.equal(this.array.pop(), 4);
  }

  @Spec()
  async hasToBe4AgainButNotSkipped() {
    assert.equal(this.array.pop(), 4);
  }
}