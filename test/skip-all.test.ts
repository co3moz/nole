import * as assert from 'assert';
import { Spec, Skip } from "../src/index.js";
import { SkipClass } from '../src/decorators.js';

@SkipClass('skip all class')
export class SkipAllTest {
  @Spec()
  async wontRun() { }

  @Skip('won\'t run too')
  @Spec()
  async wontRunToo() { }
}

@SkipClass()
export class SkipAllWithoutReason {
  @Spec()
  async wontRun() { }
}
