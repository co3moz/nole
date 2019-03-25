#!/usr/bin/env node

const program = require('commander');
const glob = require('glob');
const path = require('path');
const colors = require('colors/safe');
const package = require('../package.json');
const { ManualRun } = require('../dist/run');
const { TimeDifference } = require('../dist/utils/time_difference');
const { TimeResolve } = require('../dist/utils/time_factor');

program
  .usage('<glob> ...')
  .option('-T, --no-typescript', 'disable ts-node register')
  .version(package.version)
  .parse(process.argv);


if (!program.args.length) {
  program.help()
} else {
  let time = TimeDifference.begin();

  Promise.all(program.args.map(arg => new Promise((resolve, reject) => {
    glob(arg, (err, matches) => {
      if (err) {
        return reject(err);
      }

      resolve(matches);
    })
  }))).then(list => {
    let fileList = [];

    for (let item of list) {
      while (item.length) fileList.push(path.resolve(process.cwd(), item.pop()));
    }

    if (!fileList.length) {
      failed('0 files found');
      process.exit(1);
    }

    let file = time.end();

    if (program.typescript) {
      require('ts-node').register();
    }

    for (let file of fileList) {
      require(file);
    }

    let prop = time.end();

    console.log('Nole tests v' + package.version);
    ManualRun().then(() => {
      console.log(' discover: %s', TimeResolve(file))
      console.log('  resolve: %s', TimeResolve(prop - file))
      console.log('    tests: %s', TimeResolve(time.end() - prop))
      // console.log('file: %s, compile: %s, tests: %s', TimeResolve(file), TimeResolve(prop), TimeResolve(time.end()))
      process.exit(0);
    }).catch(e => {
      process.exit(1);
    })
  }).catch(e => {
    failed('Error occurred on resolving files');
    console.error(e.stack || e);
    process.exit(1);
  })
}


function failed(message) {
  console.error(colors.bold(colors.red(' (failed) ' + message)))
}