#!/usr/bin/env node

import program from "commander";
import { glob } from "glob";
import path from "path";
import fs from "fs";
import colors from "colors/safe.js";
import { register } from "tsx/esm/api";
const unregister = register();

import { TimeDifference } from "../dist/utils/time_difference.js";
import { Delay, TimeResolve } from "../dist/utils/time_factor.js";
import { TEST_CLASS_KEY } from "../dist/symbol.js";
import { ManualRun } from "../dist/run.js";

const pkg = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url)).toString(),
);

program.usage("<glob> ...").version(pkg.version).parse(process.argv);

if (!program.args.length) {
  program.help();
} else {
  let time = TimeDifference.begin();

  Promise.all(program.args.map((arg) => glob(arg)))
    .then(async (list) => {
      const fileList = [];

      for (const item of list) {
        while (item.length) {
          fileList.push(path.resolve(process.cwd(), item.pop()));
        }
      }

      if (!fileList.length) {
        failed("0 files found");
        process.exit(1);
      }

      const file = time.end();

      const tests = new Set();

      for (const file of fileList) {
        const module = await import(`file://${file}`);

        for (const key in module) {
          const value = module[key];

          if (!value) {
            continue;
          }

          if (!value[TEST_CLASS_KEY]) {
            continue;
          }

          tests.add(value);
        }
      }

      const prop = time.end();

      let dependencyResolveWaitPeriod = +process.env.NOLE_WAIT_PERIOD;

      if (
        isNaN(dependencyResolveWaitPeriod) ||
        dependencyResolveWaitPeriod < 0
      ) {
        dependencyResolveWaitPeriod = 500;
      }

      console.log("Nole tests v" + pkg.version);

      try {
        await Delay(dependencyResolveWaitPeriod);

        try {
          await ManualRun(tests);
        } catch (e) {
          if (e.message === "No specs found") {
            log(`${FAILED_TEXT} no specs found`);
          }
          throw e;
        }

        console.log(" discover: %s", TimeResolve(file));
        console.log("  resolve: %s", TimeResolve(prop - file));
        console.log(
          "    tests: %s",
          TimeResolve(time.end() - prop - dependencyResolveWaitPeriod),
        );
        process.exit(0);
      } catch (e) {
        console.error(e);
        process.exit(1);
      }
    })
    .catch((e) => {
      failed("Error occurred on resolving files");
      console.error(e.stack || e);
      process.exit(1);
    });
}

function failed(message) {
  console.error(colors.bold(colors.red(" (failed) " + message)));
}
