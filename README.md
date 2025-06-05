# Generic Pool

## About

Generic resource pool with Promise based API. Now written in TypeScript, providing strong typing and improved developer experience. Can be used to reuse or throttle usage of expensive resources such as database connections. Suitable for both Node.js and modern browser environments.

**V3 upgrade warning**

Version 3 contains many breaking changes. The differences are mostly minor and I hope easy to accommodate. There is a very rough and basic [upgrade guide](https://gist.github.com/sandfox/5ca20648b60a0cb959638c0cd6fcd02d) I've written, improvements and other attempts most welcome.

If you are after the older version 2 of this library you should look at the [current github branch](https://github.com/coopernurse/node-pool/tree/v2.5) for it.


## History

The history has been moved to the [CHANGELOG](CHANGELOG.md)


## Installation

```sh
$ npm install generic-pool [--save]
```
Includes TypeScript type definitions out of the box.


## Example

Here is an example using a fictional generic database driver that doesn't implement any pooling whatsoever itself.

```typescript
import { createPool, IFactory, IPoolOptionsParams } from 'generic-pool'; // Or appropriate path e.g. './dist' if using locally

// Define a type for your resource
interface MyDbClient {
  id: number; // Example property
  query(sql: string, params: any[], callback: () => void): void;
  disconnect(): void;
  // Add other methods your client would have
}

// Fictional DbDriver providing MyDbClient instances
const DbDriver = {
  _counter: 0,
  createClient(): Promise<MyDbClient> {
    const newClient: MyDbClient = {
      id: this._counter++,
      query: (sql, params, cb) => {
        console.log(`Client [${newClient.id}] Querying: ${sql}`);
        setTimeout(() => {
          // console.log(`Client [${newClient.id}] Query finished`);
          cb();
        }, 50);
      },
      disconnect: () => {
        console.log(`Client [${newClient.id}] disconnected`);
      }
    };
    return Promise.resolve(newClient);
  }
};

const factory: IFactory<MyDbClient> = {
  create: function(): Promise<MyDbClient> {
    console.log('Factory: Creating DB client');
    return DbDriver.createClient();
  },
  destroy: function(client: MyDbClient): Promise<void> {
    console.log(`Factory: Destroying DB client ${client.id}`);
    client.disconnect();
    return Promise.resolve();
  },
  validate: function(client: MyDbClient): Promise<boolean> {
    console.log(`Factory: Validating DB client ${client.id}`);
    return Promise.resolve(true); // Assume valid
  }
};

const opts: Partial<IPoolOptionsParams> = {
  max: 10,
  min: 2,
  // testOnBorrow: true, // Example: enable validation on borrow
  // acquireTimeoutMillis: 5000,
};

const myPool = createPool<MyDbClient>(factory, opts);

async function useClient(taskNum: number) {
  try {
    const client = await myPool.acquire();
    console.log(`Task ${taskNum}: Acquired client: ${client.id}, Pool available: ${myPool.available}, borrowed: ${myPool.borrowed}`);
    client.query("select * from foo", [], () => {
      console.log(`Task ${taskNum}: Query done, releasing client: ${client.id}`);
      myPool.release(client);
    });
  } catch (err) {
    console.error(`Task ${taskNum}: Failed to acquire client:`, err);
  }
}

// Simulate multiple concurrent uses
useClient(1);
useClient(2);
useClient(3);

// Example: Periodically log pool status
// setInterval(() => {
//   console.log(`Pool status: size=${myPool.size}, available=${myPool.available}, borrowed=${myPool.borrowed}, pending=${myPool.pending}`);
// }, 1000);

// Drain pool during shutdown
async function shutdown() {
  console.log('Shutting down, draining pool...');
  await myPool.drain();
  console.log('Pool drained, clearing resources...');
  await myPool.clear();
  console.log('Pool cleared and shutdown complete.');
}

// Example of triggering shutdown after some time
// setTimeout(shutdown, 5000);
```

### Browser Usage Example
```html
<!-- browser_example.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Generic Pool Browser Example</title>
  <meta charset="utf-8"/>
</head>
<body>
  <h1>Generic Pool Browser Example</h1>
  <p>Check the console for output.</p>
  <script type="module">
    // Adjust path to where your compiled generic-pool (e.g., dist/index.js) is accessible.
    // This might be from a local server, a CDN, or bundled with your application.
    import { createPool } from './path/to/generic-pool/dist/index.js';

    const factory = {
      create: () => {
        console.log('Creating resource in browser...');
        const resource = { id: Math.random().toString(36).substr(2, 9), data: 'Sample Data' };
        return Promise.resolve(resource);
      },
      destroy: (resource) => {
        console.log('Destroying resource in browser...', resource.id);
        return Promise.resolve();
      }
    };

    const pool = createPool(factory, { max: 2, min: 0 });

    async function doWork(taskName) {
      try {
        const resource = await pool.acquire();
        console.log(`${taskName}: Acquired resource:`, resource.id, `Pool available: ${pool.available}, borrowed: ${pool.borrowed}`);
        // Simulate work
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 200));
        console.log(`${taskName}: Work done with resource:`, resource.id);
        pool.release(resource);
        console.log(`${taskName}: Released resource:`, resource.id, `Pool available: ${pool.available}, borrowed: ${pool.borrowed}`);
      } catch (error) {
        console.error(`${taskName}: Error -`, error);
      }
    }

    document.body.innerHTML += '<button id="taskBtn">Run Task</button> <button id="statusBtn">Log Status</button>';
    let taskCounter = 1;
    document.getElementById('taskBtn').onclick = () => doWork(`Task ${taskCounter++}`);
    document.getElementById('statusBtn').onclick = () => {
      console.log(`Pool status: size=${pool.size}, available=${pool.available}, borrowed=${pool.borrowed}, pending=${pool.pending}`);
    };

    // Initial tasks
    doWork('Initial Task 1');
    doWork('Initial Task 2');
  </script>
</body>
</html>
```
Note: The path to `index.js` (e.g., `./path/to/generic-pool/dist/index.js`) in the browser example will vary based on your project setup and how you serve or bundle the library.


## Documentation

### Creating a pool

Whilst it is possible to directly instantiate the Pool class directly, it is recommended to use the `createPool` function exported by module as the constructor method signature may change in the future.

### createPool

The createPool function takes two arguments:

- `factory` :  an object conforming to the `IFactory<T>` interface, containing functions to create/destroy/test resources for the `Pool`.
- `opts` : an optional object/dictionary (conforming to `Partial<IPoolOptionsParams>`) to allow configuring/altering behaviour of the `Pool`.

```typescript
import { createPool, IFactory, IPoolOptionsParams } from 'generic-pool';
// const pool = createPool<ResourceType>(factory, opts);
```

**factory**

Must be an object that implements the `IFactory<T>` interface:

- `create: () => Promise<T>`: A function that the pool will call when it wants a new resource. It must return a Promise that either resolves to a resource of type `T` or rejects with an `Error` if it is unable to create a resource.
- `destroy: (resource: T) => Promise<void>`: A function that the pool will call when it wants to destroy a resource. It accepts one argument `resource` (of type `T`). The function must return a `Promise` that resolves once it has destroyed the resource.

Optionally, it can also have the following property:

- `validate?: (resource: T) => Promise<boolean>`: A function that the pool will call if it wants to validate a resource (e.g., when `testOnBorrow` or `testOnReturn` is true). It accepts one argument `resource` (of type `T`). It must return a `Promise` that resolves to a `boolean` (`true` if the resource is valid, `false` otherwise).

**opts**

An optional object/dictionary with any of the following properties (refer to `IPoolOptionsParams` for full details):

- `max`: `number`, maximum number of resources to create at any given time. (default=1)
- `min`: `number`, minimum number of resources to keep in pool at any given time. If this is set >= max, the pool will silently set the min to equal `max`. (default=0)
- `maxWaitingClients`: `number`, maximum number of queued requests allowed, additional `acquire` calls will be callback with an `err` in a future cycle of the event loop.
- `testOnBorrow`: `boolean`, should the pool validate resources before giving them to clients. Requires that `factory.validate` is specified. (default=false)
- `testOnReturn`: `boolean`, should the pool validate resources before returning them to the pool. Requires that `factory.validate` is specified. (default=false)
- `acquireTimeoutMillis`: `number`, max milliseconds an `acquire` call will wait for a resource before timing out. (default no limit), if supplied should be a non-zero positive integer.
- `destroyTimeoutMillis`: `number`, max milliseconds a `destroy` call will wait for a resource before timing out. (default no limit), if supplied should be a non-zero positive integer.
- `fifo` : `boolean`, if true the oldest resources will be first to be allocated. If false the most recently released resources will be the first to be allocated. This in effect turns the pool's behaviour from a queue into a stack. (default true)
- `priorityRange`: `number`, integer between 1 and x - if set, borrowers can specify their relative priority in the queue if no resources are available. (default 1)
- `autostart`: `boolean`, should the pool start creating resources, initialize the evictor, etc once the constructor is called. If false, the pool can be started by calling `pool.start()`, otherwise the first call to `acquire()` will start the pool. (default true)
- `evictionRunIntervalMillis`: `number`, How often to run eviction checks. Default: 0 (does not run).
- `numTestsPerEvictionRun`: `number`, Number of resources to check each eviction run. Default: 3.
- `softIdleTimeoutMillis`: `number`, amount of time an object may sit idle in the pool before it is eligible for eviction by the idle object evictor (if any), with the extra condition that at least `min` resources remain in the pool. Default -1 (nothing can get evicted based on this rule).
- `idleTimeoutMillis`: `number`, the minimum amount of time that an object may sit idle in the pool before it is eligible for eviction due to idle time. Supersedes `softIdleTimeoutMillis` if stricter. Default: 30000ms.
- `Promise`: `PromiseConstructor`, a Promises/A+ implementation that the pool should use. Defaults to global `Promise`. Useful in older environments if you need to inject a specific Promise polyfill, though the library targets ES2015+ where native Promise is available.

### pool.acquire

```typescript
// const resource: Promise<ResourceType> = pool.acquire(priority?: number);
pool.acquire().then((resource) => {
  // use resource
  // pool.release(resource) or pool.destroy(resource)
}).catch((err) => {
  // handle error
});
```

This function is for when you want to "borrow" a resource from the pool.

`acquire` takes one optional argument:

- `priority`: `number`, see **Priority Queueing** below.

and returns a `Promise<T>`. Once a resource in the pool is available, the promise will be resolved with a resource of type `T`. If the Pool is unable to provide a resource (e.g., timeout or `maxWaitingClients` exceeded), the promise will be rejected with an `Error`.

### pool.release

```typescript
// pool.release(resource: ResourceType): Promise<void>
pool.release(resource).then(() => {
  // resource accepted back into pool
}).catch((err) => {
  // failed to release resource
});
```

This function is for when you want to return a resource to the pool.

`release` takes one required argument:

- `resource`: `T`, a previously borrowed resource.

and returns a `Promise<void>`. This promise will resolve once the `resource` is accepted by the pool, or reject if the pool is unable to accept the `resource` for any reason (e.g., `resource` is not a resource that came from this pool). If you do not care about the outcome, it is safe to ignore this promise.

### pool.isBorrowedResource

```typescript
// const isBorrowed: boolean = pool.isBorrowedResource(resource: ResourceType)
if (pool.isBorrowedResource(someResource)) {
  // ...
}
```

This function is for when you need to check if a resource has been acquired from the pool and not yet released/destroyed.

`isBorrowedResource` takes one required argument:

- `resource`: `T`, any object which you need to test.

and returns `true` (primitive, not Promise) if the resource is currently borrowed from the pool, `false` otherwise.

### pool.destroy

```typescript
// pool.destroy(resource: ResourceType): Promise<void>
pool.destroy(resource).then(() => {
  // resource accepted and will be destroyed
}).catch((err) => {
  // failed to destroy resource
});
```

This function is for when you want to return a resource to the pool but want it destroyed rather than being made available to other borrowers. E.g., you may know the resource has timed out, become corrupted, or is no longer needed.

`destroy` takes one required argument:

- `resource`: `T`, a previously borrowed resource.

and returns a `Promise<void>`. This promise will resolve once the `resource` is accepted by the pool for destruction, or reject if the pool is unable to accept the `resource` for any reason. If you do not care about the outcome, it is safe to ignore this promise.

### pool.on

```typescript
pool.on('factoryCreateError', (err: any) => {
  // log stuff maybe
});

pool.on('factoryDestroyError', (err: any) => {
  // log stuff maybe
});
```

The pool is an event emitter (inherits from `SimpleEventEmitter`). Below are the events it emits and any args for those events:

- `factoryCreateError` : emitted when a promise returned by `factory.create` is rejected. If this event has no listeners then the `error` will be silently discarded.
  - `err`: `any`, whatever `reason` the promise was rejected with.

- `factoryDestroyError` : emitted when a promise returned by `factory.destroy` is rejected. If this event has no listeners then the `error` will be silently discarded.
  - `err`: `any`, whatever `reason` the promise was rejected with.

### pool.start

```typescript
pool.start();
```

If `autostart` was set to `false` in the pool options, this method can be used to manually start the pool. This includes initiating the creation of minimum resources, starting the evictor (if configured), and allowing `acquire` calls to be processed.

### pool.ready

```typescript
// pool.ready(): Promise<void>
pool.ready().then(() => {
  // Pool has at least 'min' resources available or created/creating
});
```

Returns a `Promise<void>` that resolves when the pool has reached its minimum configured resource count (`min`) and is considered "ready". If `min` is 0, it resolves quickly.

### pool.use

```typescript
// async function myTask(dbClient: MyDbClient): Promise<string> {
//   // Do something with dbClient
//   return "result";
// }
// pool.use<string>(myTask, priority?: number): Promise<string>

pool.use(async (resource) => {
  // do something with the resource
  return someValue; // This value will be the resolution of pool.use() promise
}).then((result) => {
  // result is someValue
}).catch((err) => {
  // Handle errors from acquisition or from the user function
});
```

This method handles acquiring a `resource` from the pool, passing it to your function, and then ensuring `pool.release(resource)` is called if your function resolves, or `pool.destroy(resource)` if your function rejects.

`use` takes one or two arguments:

- `fn: (resource: T) => Promise<U> | U`: A function that accepts a resource of type `T` and returns a `Promise` resolving to type `U`, or directly a value of type `U`.
- `priority?: number`: Optionally, you can specify the priority for acquiring the resource. See [Priority Queueing](#priority-queueing) section.

It returns a `Promise<U>` that either resolves with the value returned/resolved by your function `fn`, or rejects if resource acquisition fails or `fn` throws/rejects.

## Browser Usage

This library is built with TypeScript and can be used directly in modern browsers that support ES modules.
It no longer relies on Node.js-specific APIs like `EventEmitter` (uses a lightweight internal version) or `process.nextTick`.

See the [Browser Usage Example](#browser-usage-example) above for a practical demonstration.

For older browsers lacking native `Promise` or other ES2015 features, you may need to provide polyfills for those features.

## Building from Source

To build the library from its TypeScript source:

1. Clone the repository: `git clone https://github.com/coopernurse/node-pool.git`
2. Navigate to the directory: `cd node-pool`
3. Install dependencies: `npm install`
4. Run the build script: `npm run build`

The compiled JavaScript (ES modules and type definitions) will be placed in the `dist/` directory.

## Idle Object Eviction

The pool has an evictor (off by default) which will inspect idle items in the pool and `destroy` them if they are too old or if the pool is over its configured soft limit.

By default, the evictor does not run. To enable it, you must set the `evictionRunIntervalMillis` option to a non-zero positive value. Once enabled, the evictor will check at most `numTestsPerEvictionRun` resources each time it runs. This is to prevent it from blocking your application if you have many resources in the pool.

Eviction conditions:
- A resource's idle time exceeds `softIdleTimeoutMillis`, AND the current number of available objects is greater than `min`.
- A resource's idle time exceeds `idleTimeoutMillis`.

## Priority Queueing

The pool supports optional priority queueing. This becomes relevant when no resources are available and the caller has to wait. `acquire()` accepts an optional priority `number` which specifies the caller's relative position in the queue. Each priority slot has its own internal queue. When a resource is available for borrowing, the first request in the highest priority queue (lower number means higher priority) will be given it.

Specifying a `priority` to `acquire` that is outside the `priorityRange` (0 to `priorityRange` - 1) set at `Pool` creation time will result in the `priority` being adjusted to the lowest possible priority.

```typescript
// Create pool with priorityRange of 3 (priorities 0, 1, 2)
const opts: Partial<IPoolOptionsParams> = {
  priorityRange : 3
};
const pool = createPool<MyResourceType>(someFactory, opts);

// Acquire connection - no priority specified - defaults to lowest valid priority (e.g., 0 if range is 1, or middle if range > 1, check impl)
// Or, more accurately, it often defaults to a specific numeric priority like 0 or a median if not provided.
// For this library, if not specified, it's often treated as a default priority (e.g., 0 or as configured).
// Let's assume priority 0 is highest if not specified.
pool.acquire().then(function(client) {
    pool.release(client);
});

// Acquire connection - high priority (e.g., 0)
pool.acquire(0).then(function(client) {
    pool.release(client);
});

// Acquire connection - medium priority (e.g., 1)
pool.acquire(1).then(function(client) {
    pool.release(client);
});
```

## Draining

If you are shutting down a long-lived process, you may notice that it fails to exit for a period (e.g., 30 seconds). This can be a side effect of `idleTimeoutMillis` behavior if the pool has active `setTimeout` calls registered in the event loop for managing timeouts or eviction. Node.js won't terminate until these are cleared or complete.

This behavior is more problematic when `factory.min > 0`, as the pool will attempt to maintain a minimum number of resources, potentially preventing it from becoming empty and stopping timeout-related activities.

In these cases, use the `pool.drain()` function. This transitions the pool into a "draining" state. In this state, new `acquire` calls are rejected, and the pool waits for all currently borrowed resources to be returned. Once all resources are returned, the promise from `drain()` resolves. This helps ensure a graceful shutdown.

If you want to terminate all available (idle) resources in your pool immediately, rather than waiting for their individual timeouts, you can use `pool.clear()` in conjunction with `drain()`:

```typescript
// pool.drain(): Promise<void>
// pool.clear(): Promise<void[]> (or Promise<void> if simplified)
pool.drain()
  .then(() => {
    return pool.clear();
  })
  .then(() => {
    console.log('Pool has been drained and cleared.');
    // Now it's safer to exit the application
  })
  .catch(err => {
    console.error('Error during pool shutdown:', err);
  });
```
The promise returned by `drain().then(() => pool.clear())` will resolve once all waiting clients have acquired and returned resources, and then all available resources have been destroyed by `clear()`.

A side-effect of calling `drain()` is that subsequent calls to `acquire()` will throw an Error.

## Pooled function decoration

This has now been extracted out it's own module [generic-pool-decorator](https://github.com/sandfox/generic-pool-decorator)

## Pool info

The following properties will let you get information about the pool's current state:

```typescript
// How many more resources can the pool create before reaching 'max'.
// spareResourceCapacity: number
console.log(pool.spareResourceCapacity);

// Total number of resources currently managed by the pool (borrowed + available + creating).
// size: number
console.log(pool.size);

// Number of idle resources currently available in the pool.
// available: number
console.log(pool.available);

// Number of resources currently borrowed from the pool.
// borrowed: number
console.log(pool.borrowed);

// Number of requests currently waiting for a resource to become available.
// pending: number
console.log(pool.pending);

// Maximum number of resources the pool can manage.
// max: number
console.log(pool.max);

// Minimum number of resources the pool tries to maintain.
// min: number
console.log(pool.min);
```

## Run Tests

The library now includes unit tests that can be run in a browser.

To run tests:
1. Ensure you have built the library: `npm run build`.
2. Serve the project root directory using a local HTTP server (e.g., `npx serve .` or `python -m http.server`).
3. Open `test/browser/test.html` in your web browser and check the console for test results.

(Note: The previous Node.js `tap` tests are not actively maintained for the TypeScript version).

## Linting

We use ESLint combined with Prettier for code linting and formatting. Run `npm run lint` to check for issues or `npm run lint-fix` to automatically fix them (scripts assumed to be in `package.json`).


## License

(The MIT License)

Copyright (c) 2010-2023 James Cooper &lt;james@bitmechanic.com&gt; and contributors.

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
