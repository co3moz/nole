#!/usr/bin/env node

import program from "commander";
import glob from "glob";
import path from "path";
import fs from "fs";
import colors from "colors/safe.js";
import { ManualRun } from "../dist/run.js";
import { TimeDifference } from "../dist/utils/time_difference.js";
import { Delay, TimeResolve } from "../dist/utils/time_factor.js";
import { register } from "node:module";
import { pathToFileURL } from "node:url";
register("ts-node/esm", pathToFileURL("./"));

const pkg = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url)).toString()
);

program
  .usage("<glob> ...")
  .option("-L, --no-log", "disable console.log")
  .option("-O, --order-debug", "shows execution order")
  .version(pkg.version)
  .parse(process.argv);

if (!program.args.length) {
  program.help();
} else {
  let time = TimeDifference.begin();

  let log = console.log.bind(console);

  if (!program.log) {
    console.log = function () {};
  }

  Promise.all(
    program.args.map(
      (arg) =>
        new Promise((resolve, reject) => {
          glob(arg, (err, matches) => {
            if (err) {
              return reject(err);
            }

            resolve(matches);
          });
        })
    )
  )
    .then(async (list) => {
      const fileList = [];

      for (const item of list) {
        while (item.length)
          fileList.push(path.resolve(process.cwd(), item.pop()));
      }

      if (!fileList.length) {
        failed("0 files found");
        process.exit(1);
      }

      const file = time.end();

      for (const file of fileList) {
        await import(`file://${file}`);
      }

      const prop = time.end();

      let dependencyResolveWaitPeriod = +process.env.NOLE_WAIT_PERIOD;

      if (
        isNaN(dependencyResolveWaitPeriod) ||
        dependencyResolveWaitPeriod < 0
      ) {
        dependencyResolveWaitPeriod = 500;
      }

      log("Nole tests v" + pkg.version);
      try {
        await Delay(dependencyResolveWaitPeriod);

        await ManualRun({
          log,
          orderDebug: program.orderDebug,
        });

        log(" discover: %s", TimeResolve(file));
        log("  resolve: %s", TimeResolve(prop - file));
        log(
          "    tests: %s",
          TimeResolve(time.end() - prop - dependencyResolveWaitPeriod)
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
