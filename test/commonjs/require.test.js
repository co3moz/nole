// A plain CommonJS test file (no TypeScript, no ESM). It pulls nole in through
// its CommonJS build; a real consumer would `require("nole")` and get the same
// entry via the package "exports" map.
const { Test } = require("../../dist/cjs/index.js");

exports.CommonJSRequireTest = class CommonJSRequireTest extends Test({}) {
  async check() {
    console.log("It works from CommonJS");
  }
};
