import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Test } from "./index.js";
import { findConfigFile, isEsmFile } from "./loader.js";

export class LoaderTest extends Test() {
  root!: string;

  before() {
    this.root = fs.mkdtempSync(path.join(os.tmpdir(), "nole-loader-"));

    fs.mkdirSync(path.join(this.root, "esm"));
    fs.mkdirSync(path.join(this.root, "cjs"));
    fs.mkdirSync(path.join(this.root, "bare"));

    fs.writeFileSync(
      path.join(this.root, "esm", "package.json"),
      '{ "type": "module" }',
    );
    fs.writeFileSync(
      path.join(this.root, "cjs", "package.json"),
      '{ "type": "commonjs" }',
    );
    fs.writeFileSync(path.join(this.root, "bare", "package.json"), "{ broken");
  }

  extensionsWin() {
    assert.equal(isEsmFile(path.join(this.root, "cjs", "a.mts")), true);
    assert.equal(isEsmFile(path.join(this.root, "cjs", "a.mjs")), true);
    assert.equal(isEsmFile(path.join(this.root, "esm", "a.cts")), false);
    assert.equal(isEsmFile(path.join(this.root, "esm", "a.cjs")), false);
  }

  nearestPackageDecides() {
    assert.equal(isEsmFile(path.join(this.root, "esm", "a.ts")), true);
    assert.equal(isEsmFile(path.join(this.root, "cjs", "a.ts")), false);
  }

  unreadablePackageMeansCommonJs() {
    assert.equal(isEsmFile(path.join(this.root, "bare", "a.ts")), false);
  }

  walksUpToTheRoot() {
    // no package.json anywhere above the temporary directory
    assert.equal(isEsmFile(path.join(this.root, "a.ts")), false);
  }

  findsAConfigFile() {
    assert.equal(findConfigFile(this.root), null);

    const config = path.join(this.root, "nole.config.ts");

    fs.writeFileSync(config, "export default {}");

    assert.equal(findConfigFile(this.root), config);
  }

  cleanUp() {
    fs.rmSync(this.root, { recursive: true, force: true });
  }
}
