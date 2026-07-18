import { Test } from "../../dist/index.js";

export class CommonJSTest extends Test({}) {
  async check() {
    console.log("It works");
  }
}
