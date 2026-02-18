import * as assert from "assert";
import { Test } from "../index.js";
import { Executor } from "./executor.js";
import { TimeDifference } from "./time_difference.js";

export class TimeDifferenceTest extends Test() {
  async evaluate() {
    const td = TimeDifference.begin();
    td.end();
  }
}
