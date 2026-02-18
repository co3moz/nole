import * as assert from "assert";
import { Test } from "../dist/index";

export class SkipAllTest extends Test({
  skip: "skip all class",
}) {
  async wontRun() {}

  async wontRunToo() {}
}
