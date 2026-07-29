![](docs/nole.png)

# Nole

A test runner for TypeScript. A class is a suite. A method is a test.

```ts
// test/queue.test.ts
import { Test } from "nole";

export class QueueTest extends Test() {
  queue!: Queue;

  createInstance() {
    this.queue = new Queue();
  }

  push() {
    this.queue.push(10);
  }

  async pipe() {
    await this.queue.pipe(somewhere);
  }
}
```

```bash
$ nole './test/**/*.test.ts'
   (ok)      0.06 ms QueueTest.createInstance()
   (ok)         0 ms QueueTest.push()
   (ok)      1.63 ms QueueTest.pipe()

  3 passed  (2.48 ms)

 discover: 2.68 ms
  resolve: 80.23 ms
    tests: 2.48 ms
```

No `describe`, no `it`, no registration. Export the class and it runs.

## Install

```bash
npm i -D nole tsx
```

```json
{
  "scripts": {
    "test": "nole './test/**/*.test.ts'"
  }
}
```

Quote the glob. Nole expands it, not your shell.

## When a test fails

The run keeps going. Failures are collected and shown at the end.

```bash
$ nole './test/**/*.test.ts'
   (ok)      0.05 ms CartTest.addsItem()
 (failed)    0.52 ms CartTest.checksTotal()
           AssertionError: 24 == 25
   (ok)      0.01 ms CartTest.pays()

  Failures:

  1) CartTest.checksTotal()
     AssertionError [ERR_ASSERTION]: 24 == 25
         at CartTest.checksTotal (test/cart.test.ts:10:12)

     - expected + actual

     - 25
     + 24

  2 passed, 1 failed  (1.37 ms)
```

The stack has no nole frames in it. Only your code.

## Skip

Start the name with `skip`.

```ts
export class QueueTest extends Test() {
  skip_drain() {}
}
```

```bash
  (skip)             QueueTest.skip_drain() {marked as skipped}
```

Careful. Any name that starts with `skip` is skipped, so `skipsBadInput()` never
runs. Call it `rejectsBadInput()`.

Skip the whole class.

```ts
export class QueueTest extends Test({ skip: "no need" }) {
  push() {}
}
```

Skip one test at runtime.

```ts
import { Test, skipTest } from "nole";

export class QueueTest extends Test() {
  needsRedis() {
    if (!process.env.REDIS_URL) {
      skipTest("REDIS_URL is not set");
    }
  }
}
```

```bash
 (dskip)             QueueTest.needsRedis() {REDIS_URL is not set}
```

Skip the rest of the class at runtime. This works in `before` too.

```ts
import { Test, skipClass } from "nole";

export class RemoteTest extends Test() {
  before() {
    if (!process.env.STAGING_URL) {
      skipClass("STAGING_URL is not set");
    }
  }

  ping() {}
  pong() {}
}
```

```bash
 (dskip)             RemoteTest:before() {STAGING_URL is not set}
 (dskip)             RemoteTest.ping() {STAGING_URL is not set}
                      ↳ skip came from :before
 (dskip)             RemoteTest.pong() {STAGING_URL is not set}
                      ↳ skip came from :before
```

`skipTest()` inside a hook is an error. You meant `skipClass()`.

## Helper methods

Every method is a test. Start the name with `_` to keep one for yourself.

```ts
export class QueueTest extends Test() {
  async _connect() {
    return new Connection("...");
  }

  async push() {
    const conn = await this._connect();
    conn.push(10);
  }
}
```

Change the prefix with `--spec-skip-prefix` or `SPEC_SKIP_PREFIX`.

## Hooks

```ts
export class HookTest extends Test() {
  value = 0;

  before() {}
  beforeEach() {}
  afterEach() {}
  after() {}
  cleanUp() {}

  checks() {}
}
```

Order:

```
before        once, per class
  beforeEach  before every test
  test
  afterEach   after every test
after         once, per class
cleanUp       once, after everything that depends on this class is done
```

Want more than one hook of a kind? Start the name with `hook`. End it with the
kind you want. No ending means `before`.

```ts
export class QueueTest extends Test() {
  hookConnect() {}
  hookSeedBeforeEach() {}
  hookCloseAfter() {}

  push() {}
}
```

```bash
   (ok)      0.14 ms QueueTest.hookConnect:before()
   (ok)      0.01 ms QueueTest.hookSeedBeforeEach:beforeEach()
   (ok)      0.03 ms QueueTest.push()
   (ok)      0.01 ms QueueTest.hookCloseAfter:after()
```

`cleanUp` always runs. After a failure, after `--bail`, after ctrl+c.

## Dependencies

```ts
export class DatabaseTest extends Test() {
  connection = { open: false };

  connect() {
    this.connection.open = true;
  }

  cleanUp() {
    this.connection.open = false;
    console.log("connection closed");
  }
}

export class OrderTest extends Test({
  dependencies: { database: () => DatabaseTest },
}) {
  reads() {
    if (!this.database.connection.open) throw new Error("no connection");
  }
}
```

```bash
   (ok)      0.06 ms DatabaseTest.connect()
   (ok)      0.01 ms OrderTest.reads()
connection closed
   (ok)      0.05 ms DatabaseTest:cleanUp()
```

`DatabaseTest` runs first. Its `cleanUp` runs last, after `OrderTest` is done.

Did your dependency get skipped?

```ts
import { Test, isSkipped, skipClass } from "nole";

export class OrderTest extends Test({
  dependencies: { database: () => DatabaseTest },
}) {
  reads() {
    if (isSkipped(this.database)) {
      skipClass("no database, no orders");
    }
  }
}
```

## Order without dependencies

```ts
export class A extends Test() { a() {} }

// B runs before A
export class B extends Test({ before: () => [A] }) { b() {} }

// C runs after A
export class C extends Test({ after: () => [A] }) { c() {} }
```

```bash
   (ok)      0.05 ms B.b()
   (ok)         0 ms A.a()
   (ok)         0 ms C.c()
```

## Inheritance

```ts
class Simple extends Test() {
  value = 1;

  check() {}
}

// not exported, so nole ignores it. The children below still run.
export class Complex extends Simple {
  check() {
    super.check();
  }
}

export class MoreComplex extends Simple {
  moreSpecs() {}
}
```

Parent tests run first, so a child can build on what the parent left behind.

```ts
export class GrandparentTest extends Test() {
  variable = 1;

  doesSomething() {
    assert.equal(this.variable, 1);
    this.variable = 2;
  }
}

export class ChildTest extends GrandparentTest {
  doesMoreStuff() {
    assert.equal(this.variable, 2);
  }
}
```

```bash
   (ok)      0.08 ms ChildTest.doesSomething()
   (ok)      0.01 ms ChildTest.doesMoreStuff()
   (ok)         0 ms GrandparentTest.doesSomething()
```

Both classes are exported, so both run. Each one gets its own instance.

## Dynamic tests

```ts
import { Test, addTest } from "nole";

// not exported, nole cannot find it
class DynamicTest extends Test() {
  test() {}
}

addTest(() => DynamicTest);
```

Add one from inside a test.

```ts
export class DeepTest extends Test() {
  check() {
    if (something) {
      addTest(() => class Wololo extends Test() {});
    }
  }
}
```

Reach another class from inside a test with `getTest`. It returns `null` if
that class has not been registered yet.

```ts
import { Test, getTest } from "nole";

export class ReportTest extends Test() {
  reads() {
    const database = getTest(() => DatabaseTest);

    console.log(database?.connection);
  }
}
```

## Timeouts

Default is 5000 ms.

```ts
export class SlowTest extends Test({ timeout: 30_000 }) {}
```

```bash
$ nole './test/**/*.test.ts' --timeout 10000
```

Only know at runtime? Call `timeout()`. The clock restarts from there.

```ts
import { Test, timeout } from "nole";

export class UploadTest extends Test() {
  async uploadsABigFile() {
    timeout(60_000);

    await upload(bigFile);
  }
}
```

## Retries

```ts
let tries = 0;

export class NetworkTest extends Test({ retries: 2 }) {
  fetches() {
    if (++tries < 3) throw new Error("connection reset");
  }
}
```

```bash
 (retry)             NetworkTest.fetches() {attempt 1 failed, 2 left}
 (retry)             NetworkTest.fetches() {attempt 2 failed, 1 left}
   (ok)         0 ms NetworkTest.fetches() (flaky, passed on attempt 3)

  1 passed, 1 flaky  (1.37 ms)
```

A test that only passes on a retry is flaky, not green.

`beforeEach` and `afterEach` run again on every attempt.

Same thing for every class:

```bash
$ nole './test/**/*.test.ts' --retries 2
```

## Bail

Stop the whole run at the first failure.

```bash
$ nole './test/**/*.test.ts' --bail
```

Stop one class only. Its tests build on each other, so the rest is noise.

```ts
export class CartTest extends Test({ bail: true }) {
  addsItem() {}
  checksTotal() {}
  pays() {}
}
```

```bash
   (ok)      0.05 ms CartTest.addsItem()
 (failed)    0.52 ms CartTest.checksTotal()
           AssertionError: 24 == 25
 (block)             CartTest.pays() {an earlier spec of this class failed}
   (ok)      0.02 ms OtherTest.stillRuns()
```

Other classes keep running. `after` and `cleanUp` still run.

## Run classes in parallel

```bash
$ nole './test/**/*.test.ts' --concurrency 4
```

Dependencies are respected. Output of each class is printed as one block.

Tests inside one class always run in order. They share an instance.

Some classes cannot share the machine. A port, a directory, an env var.

```ts
export class MigrationTest extends Test({ exclusive: true }) {
  async migrates() {
    process.chdir("./tmp/workspace"); // nothing else is running right now
  }
}
```

Nole waits for the running classes to finish, runs this one alone, then goes
back to normal. Free at `--concurrency 1`.

## Run one test

```bash
$ nole './test/**/*.test.ts' --grep 'QueueTest.push'
   (ok)      0.05 ms QueueTest.push()

  1 passed, 2 filtered  (0.5 ms)
```

A `/pattern/` is a regular expression.

```bash
$ nole './test/**/*.test.ts' --grep '/^Queue.*\.p/'
```

Classes your match depends on still run in full. They set up the state it
needs.

## Reporters

```bash
$ nole './test/**/*.test.ts' --reporter dot
```

`spec` (default), `dot`, `json`, `tap`, `junit`.

```bash
$ nole './test/**/*.test.ts' -r tap
TAP version 13
ok 1 - DatabaseTest.connect
ok 2 - OrderTest.reads
ok 3 - RemoteTest.ping # SKIP STAGING_URL is not set
1..3
```

Keep the readable output and write a file for CI at the same time.

```bash
$ nole './test/**/*.test.ts' --report junit:reports/results.xml --report json:reports/results.json
```

## Config file

Drop a `nole.config.ts` next to your `package.json`.

```ts
import { defineConfig } from "nole";

export default defineConfig({
  globs: ["./test/**/*.test.ts"],
  timeout: 10_000,
  retries: 1,
  concurrency: 4,
  reporter: "dot",
  reports: [{ name: "junit", file: "./reports/results.xml" }],
});
```

```bash
$ nole
```

Flags beat the config file. `.js`, `.mjs` and `.cjs` work too.

## Watch

```bash
$ nole './test/**/*.test.ts' --watch
```

Every pass runs in a fresh process, so your changes are really reloaded.

## Coverage

```bash
$ nole './test/**/*.test.ts' --coverage
```

Runs the same command through the c8 you already have.

## CommonJS

Both builds ship. `import` gets ESM, `require` gets CommonJS.

```js
import { Test } from "nole"; // ESM
const { Test } = require("nole"); // CommonJS
```

TypeScript is optional.

```js
// test/queue.test.js
const { Test } = require("nole");

exports.QueueTest = class QueueTest extends Test() {
  check() {
    console.log("It works from CommonJS");
  }
};
```

Both kinds of file can live in one run.

```bash
$ nole './test/**/*.test.{ts,js}'
   (ok)      0.11 ms QueueTest.push()
   (ok)      0.58 ms CommonJSTest.check()
```

## Exit codes

```
0    everything passed
1    something failed
130  ctrl+c
```

## Options

```
Usage: nole <glob> ... [options]

Arguments:
  globs                        test file globs, quote them so nole expands them

Options:
  -b, --bail                   stop as soon as something fails
  -t, --grep <pattern>         only run specs matching ClassName.specName,
                               /regex/ is supported
  --timeout <ms>               override the timeout of every spec and hook
  --retries <n>                extra attempts before a failing spec is reported
  -c, --concurrency <n>        how many test classes may run at once
  -r, --reporter <name>        spec, dot, json, tap or junit
  --report <reporter:file>     also write a report to a file, repeatable
  -s, --setup <file>           load a file before discovery, repeatable
  --config <file>              path to a nole config file
  --no-config                  ignore any nole.config.* file
  --wait <ms>                  delay before the run, for late dynamic tests
  --spec-skip-prefix <prefix>  methods with this prefix are helpers
  -w, --watch                  rerun when a file changes
  --coverage                   run the suite through c8
  --no-color                   disable coloured output
  -V, --version                output the version number
  -h, --help                   display help for command
```

Class options:

```ts
Test({
  skip: "reason",             // skip the class
  timeout: 30_000,            // ms per test and hook
  retries: 2,                 // extra attempts for a failing test
  bail: true,                 // stop this class at its first failure
  exclusive: true,            // never run next to another class
  dependencies: { db: () => DatabaseTest },
  before: () => [A],          // this class runs before A
  after: () => [B],           // this class runs after B
});
```

## Your own reporter

```ts
// reporters/slack.ts
import { BaseReporter, type SpecResult } from "nole";

export class SlackReporter extends BaseReporter {
  specResult(result: SpecResult) {
    if (result.status === "failed") {
      notify(`${result.className}.${result.specName} failed`);
    }
  }
}
```

Override only what you need. Every event is optional.

Point the config file at it. Nole hands you the output stream.

```ts
// nole.config.ts
import { defineConfig } from "nole";
import { SlackReporter } from "./reporters/slack.js";

export default defineConfig({
  globs: ["./test/**/*.test.ts"],
  reporter: (write) => new SlackReporter(write),
});
```

Events, all optional:

```ts
runStart(info)      // the run is about to start
classStart(name)    // a class is about to start
hookResult(result)  // a hook finished
specResult(result)  // a test finished
retry(info)         // a test failed and will be tried again
classEnd(name)      // a class is done
runEnd(summary)     // everything is done
finalize()          // flush your buffers, may return a promise
```

## License

MIT
