![](docs/nole.png)

Nole
==========

Nole is a testing platform just like mocha.. You can create test classes and declare specs with decorators..

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

After end of the test tree, special hook will be called. Nole will follow execution order to run; first executed spec's "EndOfTree" hook will be called last.


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

  @Hook(HookType.EndOfTree)
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

## Compiled files

You can run the compiled test files with `-T` option.

```bash
$ nole -T ./build/test/**/*.test.js
  (ok)      0.09 ms QueueTest.CreateInstance()
  (ok)      0.11 ms QueueTest.Push()
  (ok)      1.09 ms QueueTest.Pipe()
```

> This will prevent to load ts-node register. It will be quite faster.