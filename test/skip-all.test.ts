import * as assert from 'assert';
import { Spec, Skip } from "../src";
import { SkipClass } from '../src/decorators';

@SkipClass('skip all class')
export class SkipAllTest {
  @Spec()
  async wontRun() { }

  @Skip('won\'t run too')
  @Spec()
  async wontRunToo() { }
}