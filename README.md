![](docs/nole.png)

Nole
==========

Nole is a testing platform just like mocha.. You can create test classes and declare specs with decorators..

> Use nole 2.x for ESM and Typescript.

> Use nole 1.x for CommonJS. (ability to disable Typescript with -T option)

```ts
// test/queue.test.ts
import { Spec } from 'nole';

class QueueTest {
  queue!: Queue;

  @Spec()
  CreateInstance() {
    this.queue = new Queue();  
  }

  @Spec()
  Push() {
    this.queue.push(10);
  }

  @Spec(1000)
  async Pipe() {
    await this.queue.pipe(somewhere);
  }
}
```

```bash
$ nole ./test/**/*.test.ts
  (ok)      0.09 ms QueueTest.CreateInstance()
  (ok)      0.11 ms QueueTest.Push()
  (ok)      1.09 ms QueueTest.Pipe()
```

## Spec

Declaring the spec tag will notify the nole core and assigns the tasks for later use. You can also specify timeout. Default timeout is 5000 ms.

```ts
// test/queue.test.ts
import { Spec } from 'nole';

class QueueTest {
  @Spec(10000)
  Push() {
    this.queue.push(10);
  }
}
```

> * All specs will be executed as creation order.
> * Timing colors are defined by timeout value. If value smaller than (timeout / 5) output will be green. If value bigger than this but smaller than (timeout / 2.5); it will be yellow. In all other cases color will be red.


## Skip

You can skip tests. (hooks will be disabled for this spec)

```ts
// test/queue.test.ts
import { Spec, Skip } from 'nole';

class QueueTest {
  @Skip('deprecated unit')
  @Spec()
  Push() {
    this.queue.push(10);
  }
}
```

> * Skipping the task make it yellow colored.

```bash
$ nole ./**/test/*.test.ts
  (skip)              QueueTest.Push() {deprecated unit}
```

## SkipClass

You can skip whole test classes. It's equivalent of spec skipping, but you don't have to select one by one. 
**Kindly reminder**: Dependents might require this test class and props. 

```ts
// test/queue-skip-class.test.ts
import { Spec, Skip, SkipClass } from 'nole';

@SkipClass('No need anymore')
class QueueTest {
  @Spec()
  Push() { }

  @Skip('deprecated unit')
  @Spec()
  PushButSomehowDifferent() { }
}
```

```bash
$ nole ./**/test/*.test.ts
  (skip)              QueueTest.Push() {No need anymore}
  (skip)              QueueTest.PushButSomehowDifferent() {deprecated unit}
```


## Dependencies

You can include other tests and wait them to complete.

```ts
// test/database.test.ts
import { Spec } from 'nole';

export class Database {
  connection!: any;

  @Spec() 
  async Connect() {
    connection = new Connection('...');

    await connection.connect();
  }
}
```

```ts
// test/other.test.ts
import { Spec, Dependency } from 'nole';
import { Database } from './database.test';

class Other {
  @Dependency(Database)
  database!: Database;

  @Spec() 
  async DoThings() {
    await database.connection.doStuff();
  }
}
```

> * All dependencies will be waited until done
> * If dependencies cannot resolve, it will occurr an error after the available tests done.


## Multi Dependencies

Easier way to declare dependencies by decorating class with an array.

```ts
// test/redis.test.ts
import { Spec, Dependencies } from 'nole';
import { Database } from './database.test';
import { Other } from './other.test';

@Dependencies([
  Database,
  Other
])
class Redis {
  database: Database; // camel-case syntax
  // even though other does not exist in this test, but nole will make sure it is completed when this test runs

  @Spec() 
  async DoThings() {
    await database.connection.doStuff();
  }
}
```

## Hook

Hooks will help you to develop helper methods.

```ts
// test/hook.test.ts
import { Spec, Hook, HookType } from 'nole';

class HookTest {
  value!: number;

  @Hook(HookType.BeforeEach)
  async beforeEach() {
    this.value = Math.random();
  }

  @Spec()
  ValidateNumber() {
    if (this.value > 0.5) {
      throw new Error('Should not be higher than 0.5');
    }
  }
}
```

> * Hooks can be async tasks.
> * Hooks do have timeout, you can change it by second parameter.
> * If you name hook same as hook type then; When it occurr an error, It will print "class:hookType" otherwise "class.name:hoopType"
> * Hooks cannot be spec
> * Hooks cannot skipped

## Dynamic Tests

Dynamic tests are not featured in but you can create another method and call it dynamicly.


```ts
// test/dynamic.test.ts
import { Spec } from 'nole';

class DynamicTest {
  @Spec()
  Some() {
    for (let i = 0; i < 10; i++) {
      this.single(i);
    }
  }

  single(i) {
    // ...    
  }
}
```

## Dependency hook

After end of the test tree, special hook will be called. Nole will follow execution order to run; first executed spec's "CleanUp" hook will be called last.


```ts
// test/database-with-cleanup.test.ts
import { Spec, HookType, Hook } from 'nole';

export class DatabaseWithCleanup {
  connection!: any;

  @Spec() 
  async Connect() {
    connection = new Connection('...');

    await connection.connect();
  }

  @Hook(HookType.CleanUp)
  async cleanUp() {
    this.connection.close();
    console.log('Connection closed!');
  }
}
```

```ts
// test/other.test.ts
import { Spec, Dependency } from 'nole';
import { Database } from './database.test';

class Other {
  @Dependency(DatabaseWithCleanup)
  database!: DatabaseWithCleanup;

  @Spec() 
  async DoThings() {
    await database.connection.doStuff();
  }
}
```

```bash
$ nole ./test/**/*.test.ts
  (ok)      0.09 ms DatabaseWithCleanup.Connect()
  (ok)      0.11 ms Other.DoThings()
Connection closed!
```



## Assert

We do not provide assert library. You can use chai or should.js.

## Debugging

Having cleanup features with missing dependencies could lead to issues and time loses. To make sure execution of tests correct, use `-O` parameter to print out every spec and hook without calling the function. It will also print before/after hook orders.

```bash
$ nole -O ./test/**/*.test.ts
  (skip)             SkipAllTest.wontRun() {skip all class}
  (skip)             SkipAllTest.wontRunToo() {wont run too}
  (skip)             SkipAllWithoutReason.wontRun()
   (ok)         0 ms BasicTest.checkEqual()
   (ok)         0 ms DependencyTest.check()
   (ok)         0 ms CleanUpLayer1Test.start()
   (ok)         0 ms CleanUpLayer2Test.start()
   (ok)         0 ms CleanUpLayer3Test.start()
   (ok)         0 ms DynamicSkipTest.thisShouldBeSkipped()
   (ok)         0 ms HookTest.pushFourIntoArray:beforeEach()
   (ok)         0 ms HookTest.hasToBe4()
  (skip)             HookTest.hasToBe4Again() {no need}
   (ok)         0 ms HookTest.pushFourIntoArray:beforeEach()
   (ok)      0.03 ms HookTest.hasToBe4AgainButNotSkipped()
   (ok)         0 ms MultiDependency.test()
   (ok)         0 ms CleanUpLayer3Test:cleanUp()
   (ok)         0 ms CleanUpLayer2Test:cleanUp()
   (ok)         0 ms CleanUpLayer1Test:cleanUp()
   (ok)         0 ms DynamicTest.thisTestsShouldNotFail()
   (ok)         0 ms TimeFactorTest.evaluate()
   (ok)         0 ms TimeDifferenceTest.evaluate()
   (ok)         0 ms ExecutorTest.evaluate()
   (ok)         0 ms ExecutorTest.throws()
   (ok)         0 ms ExecutorTest.timeout()
```

## Compiled files

> Deprecated (v2.x+), It will always use ts-node/esm module

You can run the compiled test files with `-T` option.

```bash
$ nole -T ./build/test/**/*.test.js
  (ok)      0.09 ms QueueTest.CreateInstance()
  (ok)      0.11 ms QueueTest.Push()
  (ok)      1.09 ms QueueTest.Pipe()
```

> This will prevent to load ts-node register. It will be quite faster.

## Environment values to configure stuff

```
NOLE_PRESERVE_CONSECUTIVE_UPPERCASE=true
NOLE_PASCALCASE=false
```