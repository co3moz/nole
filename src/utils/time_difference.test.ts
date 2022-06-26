import * as assert from "assert";
import { Spec } from "../index.js";
import { Executor } from "./executor.js";
import { TimeDifference } from "./time_difference.js";

export class TimeDifferenceTest {
  @Spec()
  async evaluate() {
    const td = TimeDifference.begin();
    td.end()
  }
}
