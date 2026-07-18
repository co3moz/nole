![](docs/nole.png)

# Nole

Nole is a testing platform just like mocha..

> Breaking change at nole v3, plain old classes are better at this task.

> Use nole 2.x for ESM and Typescript.

> Use nole 1.x for CommonJS. (ability to disable Typescript with -T option)

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
$ nole ./test/**/*.test.ts
  (ok)      0.09 ms QueueTest.createInstance()
  (ok)      0.11 ms QueueTest.push()
  (ok)      1.09 ms QueueTest.pipe()
```

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

> The prefix is configurable via the `SPEC_SKIP_PREFIX` environment variable
> (defaults to `_`).

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
