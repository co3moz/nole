![](docs/nole.png)

# Nole

Nole is a testing platform just like mocha.. Feels simple, works really well.

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
  (ok)      0.09 ms QueueTest.createInstance()
  (ok)      0.11 ms QueueTest.push()
  (ok)      1.09 ms QueueTest.pipe()

  3 passed  (1.29 ms)
```

A failing spec does not stop the run. Everything else still executes, every
`cleanUp` hook still runs, and the failures are collected into a summary at the
end. The process exits with `1` if anything failed.

```bash
$ nole './test/**/*.test.ts'
  (ok)      0.09 ms QueueTest.createInstance()
 (failed)   0.11 ms QueueTest.push()
           Error: queue is full
  (ok)      1.09 ms QueueTest.pipe()

  Failures:

  1) QueueTest.push()
     Error: queue is full
         at QueueTest.push (test/queue.test.ts:19:11)

  2 passed, 1 failed  (1.29 ms)
```

Use `--bail` when you would rather stop at the first failure.

## Command line

```
nole <glob> ... [options]

  -b, --bail                 stop as soon as something fails
  -t, --grep <pattern>       only run specs matching ClassName.specName,
                             /regex/ is supported
      --timeout <ms>         override the timeout of every spec and hook
      --retries <n>          extra attempts before a failing spec is reported
  -c, --concurrency <n>      how many test classes may run at once
  -r, --reporter <name>      spec, dot, json, tap or junit
      --report <name:file>   also write a report to a file, repeatable
  -s, --setup <file>         load a file before discovery, repeatable
      --config <file>        path to a nole config file
      --no-config            ignore any nole.config.* file
      --wait <ms>            delay before the run, for late dynamic tests
      --spec-skip-prefix <p> methods with this prefix are helpers
  -w, --watch                rerun when a file changes
      --coverage             run the suite through c8
      --no-color             disable coloured output
```

> Quote your globs (`'./test/**/*.test.{ts,js}'`) so nole expands them itself
> instead of relying on the shell — this keeps discovery consistent across
> environments.

> `--wait` defaults to `0`. Tests registered with `addTest()` while a module is
> being imported are picked up without it; raise it (or set `NOLE_WAIT_PERIOD`)
> only if something in your setup registers tests later than that.

### Config file

Put a `nole.config.ts` (or `.js`, `.mjs`, `.cjs`) next to your `package.json`
and nole picks it up on its own. Every key matches a flag, and the flag wins.

```ts
// nole.config.ts
import { defineConfig } from "nole";

export default defineConfig({
  globs: ["./test/**/*.test.ts"],
  timeout: 10_000,
  retries: 1,
  reports: [{ name: "junit", file: "./reports/results.xml" }],
});
```

```bash
$ nole
```

### Running one test

```bash
$ nole './test/**/*.test.ts' --grep 'QueueTest.push'
```

Classes the matched specs depend on still run in full — they are what set up
the state the matched spec needs. Everything else is reported as `filtered`.

> Working out which specs exist means constructing every discovered class, so
> `--grep` runs the constructors even of classes it ends up filtering out. Their
> hooks and specs are never touched.

### Reporters

`--reporter` chooses what goes to stdout, `--report` writes extra copies to
files, so a CI run can stay readable and still produce a machine readable
artifact:

```bash
$ nole './test/**/*.test.ts' --reporter dot --report junit:reports/results.xml
```

Writing your own is a matter of implementing `Reporter`, or extending
`BaseReporter` and overriding only the events you care about:

```ts
import { BaseReporter, type SpecResult } from "nole";

export class SlackReporter extends BaseReporter {
  specResult(result: SpecResult) {
    if (result.status === "failed") {
      notify(`${result.className}.${result.specName} failed`);
    }
  }
}
```

### Running classes in parallel

Test classes with no dependency between them can run at the same time. The
dependency graph is still respected, and the output of each class is buffered so
it stays readable.

```bash
$ nole './test/**/*.test.ts' --concurrency 4
```

> Specs inside one class always run in order — they share an instance.

Not every class survives having company. One that touches the working
directory, an environment variable, a fixed port or any other process wide
resource can be marked `exclusive`, and the runner gives it the lane to itself:

```ts
// test/migration.test.ts
import { Test } from "nole";

export class MigrationTest extends Test({ exclusive: true }) {
  async migrates() {
    process.chdir(this.workspace); // nothing else may be running right now
  }
}
```

Nole waits for whatever is in flight to finish, runs the exclusive class on its
own, and then goes back to normal. The flag costs nothing at `--concurrency 1`,
so it is safe to add as soon as you know a class needs it rather than after a
parallel run starts failing.

### Retrying flaky specs

```bash
$ nole './test/**/*.test.ts' --retries 2
```

```ts
// or per class, which is usually the honest place for it
export class NetworkTest extends Test({ retries: 2 }) {}
```

A spec that only passes on a later attempt is reported as flaky instead of
being silently green.

## Skip

You can skip tests. Make sure method name starts with skip

```ts
// test/queue.test.ts
import { Test } from "nole";

export class QueueTest extends Test() {
  skip_Push() {
    this.queue.push(10);
  }
}
```

```bash
$ nole ./**/test/*.test.ts
  (skip)              QueueTest.skip_Push() {marked as skipped}
```

```ts
// test/queue.test.ts
import { Test } from "nole";

export class QueueTest extends Test({
  skip: "no need",
}) {
  push() {
    this.queue.push(10);
  }
}
```

```bash
$ nole ./**/test/*.test.ts
  (skip)              QueueTest.skip_Push() {no need}
```

## Dynamic Skip

Sometimes you only know at runtime whether a test should run. Call `skipTest()`
inside a spec to skip just that spec.

```ts
// test/queue.test.ts
import { Test, skipTest } from "nole";

export class QueueTest extends Test() {
  push() {
    if (!process.env.QUEUE_URL) {
      skipTest("QUEUE_URL is not set");
    }

    this.queue.push(10);
  }
}
```

```bash
$ nole ./test/**/*.test.ts
  (dskip)          QueueTest.push() {QUEUE_URL is not set}
```

### Skipping the whole class

Use `skipClass()` to dynamically skip every remaining spec of the class. This is
handy inside the `before` hook, so an unmet precondition skips the entire class
instead of failing.

```ts
// test/queue.test.ts
import { Test, skipClass } from "nole";

export class QueueTest extends Test() {
  async before() {
    if (!process.env.QUEUE_URL) {
      skipClass("QUEUE_URL is not set");
    }
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
$ nole ./test/**/*.test.ts
  (dskip)          QueueTest:before() {QUEUE_URL is not set}
  (dskip)          QueueTest.push()
                        ↳ skip came from :before
  (dskip)          QueueTest.pipe()
                        ↳ skip came from :before
```

> You can also call `skipClass()` from a spec — every spec that hasn't run yet
> will be skipped, and the report shows where the skip came from.
>
> `skipClass()` can only be used inside specs and the `before` hook. Hooks
> cannot be skipped — calling `skipTest()` inside `before` is an error; you
> probably meant `skipClass()`.

## Internal functions

Nole treats every method as a spec by default. If you need a plain helper method
that Nole should not run as a spec, prefix its name with `_`.

```ts
// test/queue.test.ts
import { Test } from "nole";

export class QueueTest extends Test() {
  async _connect() {
    // not a spec, just a helper you call yourself
    return new Connection("...");
  }

  async push() {
    const conn = await this._connect();
    conn.push(10);
  }
}
```

```bash
$ nole ./test/**/*.test.ts
  (ok)      0.11 ms QueueTest.push()
```

> The prefix is configurable with `--spec-skip-prefix` or the
> `SPEC_SKIP_PREFIX` environment variable (defaults to `_`).

## Timeouts

Every spec and hook gets `5000 ms` by default. Change it per class, for the
whole run with `--timeout`, or from inside a spec when you only find out at
runtime that something is going to take a while:

```ts
// test/upload.test.ts
import { Test, timeout } from "nole";

export class UploadTest extends Test({ timeout: 10_000 }) {
  async uploadsABigFile() {
    timeout(60_000); // counting restarts from here

    await upload(bigFile);
  }
}
```

## Hook failures

A failing hook no longer takes the whole run down with it. The failure is
reported, the specs that cannot run any more are marked as blocked, and the run
moves on to the next class:

```bash
$ nole './test/**/*.test.ts'
 (failed)   0.11 ms QueueTest:before()
           Error: could not reach the queue
 (block)             QueueTest.push() {before hook failed}
 (block)             QueueTest.pipe() {before hook failed}
  (ok)      0.09 ms OtherTest.stillRuns()
```

`cleanUp` runs regardless — after a failure, after `--bail`, and after ctrl+c —
so connections do not stay open when a run goes wrong.

## Dependencies

You can include other tests and wait them to complete.

```ts
// test/database.test.ts
import { Test } from "nole";

export class Database extends Test() {
  connection!: any;

  async connect() {
    connection = new Connection("...");

    await connection.connect();
  }
}
```

```ts
// test/other.test.ts
import { Test } from "nole";
import { Database } from "./database.test";

export class Other extends Test({
  dependencies: {
    database: () => Database,
  },
}) {
  async DoThings() {
    await this.database.connection.doStuff();
  }
}
```

> - All dependencies will be waited until done
> - If dependencies cannot resolve, it will occurr an error after the available tests done.

## Wait other tests

```ts
// test/redis.test.ts
import { Test } from "nole";

export class A extends Test() {
  async doThings() {}
}

export class B extends Test({ before: () => [A] }) {
  async doThings() {}
}
```

## Hook

Hooks will help you to develop helper methods.

```ts
// test/hook.test.ts
import { Test } from "nole";

export class HookTest {
  value!: number;

  async beforeEach() {
    this.value = Math.random();
  }

  validateNumber() {
    if (this.value > 0.5) {
      throw new Error("Should not be higher than 0.5");
    }
  }
}
```

## Dynamic Tests

```ts
// test/dynamic.test.ts
import { Test, addTest } from "nole";

// not exported, nole cannot auto-bind this class
class DynamicTest extends Test() {
  test() {}
}

// adds it anyway
addTest(() => DynamicTest);
```

```ts
// test/dynamic2.test.ts
import { Test, addTest } from "nole";

if (something) {
  addTest(
    () =>
      class Special extends Test() {
        check() {}
      },
  );
}
```

```ts
// test/dynamic3.test.ts
import { Test, addTest } from "nole";

export class DeepTest extends Test() {
  check() {
    if (something) {
      addTest(() => class Wololo extends Test() {});
    }
  }
}
```

## Test cleanup

There is a special hook that can be used to capture test finishing stage.

> **Lifecycle:**
>
> - (class) Before
> - - (method) BeforeEach
> - - (method) Spec
> - - (method) AfterEach
> - (class) After
> - (class) CleanUp \*called after dependency execution

```ts
// test/database-with-cleanup.test.ts
import { Test } from "nole";

export class DatabaseWithCleanup extends Test() {
  connection!: any;

  async connect() {
    this.connection = new Connection("...");

    await connection.connect();
  }

  async cleanUp() {
    this.connection.close();
    console.log("Connection closed!");
  }
}
```

```ts
// test/other.test.ts
import { Test } from "nole";
import { Database } from "./database.test";

export class Other extends Test({
  dependencies: {
    database: () => DatabaseWithCleanup,
  },
}) {
  async doThings() {
    await this.database.connection.doStuff();
  }
}
```

```bash
$ nole ./test/**/*.test.ts
  (ok)      0.09 ms DatabaseWithCleanup.connect()
  (ok)      0.11 ms Other.doThings()
Connection closed!
```

## Test extending

If they are classes we should be able to extend them right

```ts
// test/extending.test.ts
import { Test } from "nole";

// Simple is not exported, so nole wont handle it
class Simple extends Test() {
  value = 1;

  check() {
    if (this.value !== 1) {
      // yeah it should be 1 anyway
    }
  }
}

export class Complex extends Simple {
  check() {
    if (this.value > 0) {
      // maybe it is more than just 1?
    }

    super.check(); // or
  }
}

export class MoreComplex extends Simple {
  moreSpecs() {
    // mooree
  }
}
```

```bash
$ nole ./test/**/*.test.ts
  (ok)      0.09 ms Complex.check()
  (ok)      0.11 ms MoreComplex.check()
  (ok)      0.11 ms MoreComplex.moreSpecs()
```

### Execution order

Inherited specs run parent-first, so a child can rely on the state left behind
by its ancestors.

```ts
// test/inheritance.test.ts
import * as assert from "assert";
import { Test } from "nole";

export class GrandparentTest extends Test() {
  variable = 1;

  async doesSomething() {
    assert.equal(this.variable, 1);
    this.variable = 2;
  }
}

export class FatherTest extends GrandparentTest {
  async doesSomethingElse() {
    assert.equal(this.variable, 2);
    this.variable = 3;
  }
}

export class ChildTest extends FatherTest {
  async doesMoreStuff() {
    assert.equal(this.variable, 3);
    this.variable = 4;
  }
}
```

```bash
$ nole ./test/**/*.test.ts
  (ok)      0.09 ms ChildTest.doesSomething()
  (ok)      0.10 ms ChildTest.doesSomethingElse()
  (ok)      0.11 ms ChildTest.doesMoreStuff()
```

### Inheriting behavior

Skips and hooks are inherited too. A `skipClass()` defined on a base class skips
every subclass that reaches it, and an overridden hook can call `super` to keep
the parent's setup.

```ts
// test/inheritance.test.ts
import { Test, skipClass } from "nole";

// not exported, only used as a base
class CompanyTest extends Test() {
  async noWorkingAllowed() {
    skipClass("no working allowed");
  }
}

export class EmployeeTest extends CompanyTest {
  async work() {
    // never runs, the class is skipped
  }
}

class HookInitialTest extends Test() {
  variable = 1;

  before() {
    this.variable = 2;
  }

  test() {
    assert.equal(this.variable, 2);
  }
}

export class HookOverrideTest extends HookInitialTest {
  before() {
    super.before(); // keep the parent's setup
    this.variable = 10;
  }

  test() {
    assert.equal(this.variable, 10);
  }
}
```

## CommonJS support

Nole ships both an ESM and a CommonJS build, wired up through the package
`exports` map. Use whichever your project speaks — `import` gets the ESM build,
`require` gets the CommonJS one:

```js
import { Test } from "nole"; // ESM
const { Test } = require("nole"); // CommonJS
```

You don't even need TypeScript. A plain CommonJS `.js` test file works:

```js
// test/commonjs/require.test.js
const { Test } = require("nole");

exports.CommonJSTest = class CommonJSTest extends Test() {
  async check() {
    console.log("It works from CommonJS");
  }
};
```

When discovering tests, nole loads each file with the loader that matches its own
module format: ESM files via `import()`, CommonJS files via `require()`. The
format is decided the same way Node decides it — `.mts`/`.cts` win by extension,
otherwise the nearest `package.json` `type` field is used. So ESM and CommonJS
test files can even live side by side in one run:

```bash
$ nole './test/**/*.test.{ts,js}'
  (ok)      0.11 ms QueueTest.push()
  (ok)      0.58 ms CommonJSTest.check()
```

## Watch mode

```bash
$ nole './test/**/*.test.ts' --watch
```

Every pass runs in a fresh child process, so changed modules are actually
reloaded. A change while a run is in progress stops it and starts over.

## Coverage

`--coverage` runs the same command through the c8 you already have installed:

```bash
$ nole './test/**/*.test.ts' --coverage
```
