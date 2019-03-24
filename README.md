Mole
==========

Mole is a testing platform just like mocha.. You can create test classes and declare specs with decorators..

```ts
// test/queue.test.ts
import { Spec } from 'mole';

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
$ mole ./**/test/*.test.ts
  (ok)      0.09 ms QueueTest.CreateInstance()
  (ok)      0.11 ms QueueTest.Push()
  (ok)      1.09 ms QueueTest.Pipe()
```

## Spec

Declaring the spec tag will notify the mole core and assigns the tasks for later use. You can also specify timeout. Default timeout is 5000 ms.

```ts
// test/queue.test.ts
import { Spec, Skip } from 'mole';

class QueueTest {
  @Spec(10000)
  Push() {
    this.queue.push(10);
  }
}
```

> * Timing colors are defined by timeout value. If value smaller than (timeout / 5) output will be green. If value bigger than this but smaller than (timeout / 2.5); it will be yellow. In all other cases color will be red.


## Skip

You can skip tests. (hooks will be disabled for this spec)

```ts
// test/queue.test.ts
import { Spec, Skip } from 'mole';

class QueueTest {
  @Skip()
  @Spec()
  Push() {
    this.queue.push(10);
  }
}
```

> * Skipping the task make it yellow colored.


## Dependencies

You can include other tests and wait them to complete.

```ts
// test/database.test.ts
import { Spec } from 'mole';

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
import { Spec, Dependency } from 'mole';
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
import { Spec, Hook, HookType } from 'mole';

class HookTest {
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
> * If you name hook same as hook type then; When it occurr an error, It will print "class:hookType" other wise "class.name:hoopType"

## Dynamic Tests

Dynamic tests are not featured in but you can create another method and call it.


```ts
// test/dynamic.test.ts
import { Spec } from 'mole';

class QueueTest {
  @Spec()
  Some() {
    for(let i = 0; i < 10; i++) {
      this.single(i);
    }
  }

  single(i) {
    // ...    
  }
}
```