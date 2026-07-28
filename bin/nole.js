#!/usr/bin/env node

import { fileURLToPath } from "url";
import fs from "fs";
import { register } from "tsx/esm/api";
import { require as tsxRequire } from "tsx/cjs/api";

register();

import { runCli } from "../dist/cli.js";
import { isEsmFile } from "../dist/loader.js";

const pkg = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url)).toString(),
);

// ESM files are loaded with import(); CommonJS files (their nearest
// package.json is not "type": "module") are loaded with require(), so nole can
// run in CommonJS environments too.
async function loadFile(file) {
  return isEsmFile(file)
    ? await import(`file://${file}`)
    : tsxRequire(file, import.meta.url);
}

const code = await runCli({
  argv: process.argv,
  version: pkg.version,
  binPath: fileURLToPath(import.meta.url),
  loadFile,
});

process.exit(code);
