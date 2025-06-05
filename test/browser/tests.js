// Simple assertion functions
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}
assert.equal = function(actual, expected, message) {
  if (actual !== expected) {
    // Using console.error for better visibility of the failed values
    console.error(`Expected: ${expected}, Actual: ${actual}`);
    throw new Error(message || `Expected ${expected} but got ${actual}`);
  }
};
assert.ok = function(condition, message) {
  assert(condition, message);
};
assert.throws = async function(fn, message) {
    let caughtError = false;
    try {
        await fn();
    } catch (e) {
        caughtError = true;
    }
    if (!caughtError) {
        throw new Error(message || "Expected function to throw an error, but it did not.");
    }
};


// Test runner
const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}
async function runTests() {
  // Access createPool from the global scope (window.genericPool)
  // This is necessary because this tests.js script is not a module itself.
  if (!window.genericPool || !window.genericPool.createPool) {
    console.error("generic-pool library not found. Ensure it is loaded before tests.js and available on window.genericPool");
    return;
  }

  for (const t of tests) {
    console.log(`Running test: ${t.name}`);
    try {
      await t.fn();
      console.log(`%cPASS: ${t.name}`, 'color: green;');
    } catch (e) {
      console.error(`%cFAIL: ${t.name}`, 'color: red;');
      console.error(e.stack || e.message || e);
    }
  }
}

// Make assert and test global for easy use in this file
window.assert = assert;
window.test = test;
window.runTests = runTests; // Expose runTests globally to be called from test.html


// --- Test Code Starts Here ---

// Access createPool via the global object set up in test.html
const { createPool } = window.genericPool;

class TestResourceFactory {
  constructor() {
    this.created = 0;
    this.destroyed = 0;
    this.validated = 0;
    this.idCounter = 0;
  }
  create() {
    this.created++;
    const resource = { id: this.idCounter++, name: `Resource-${this.idCounter}` };
    // console.log('Factory: Created resource', resource);
    return Promise.resolve(resource);
  }
  destroy(resource) {
    this.destroyed++;
    // console.log('Factory: Destroyed resource', resource);
    return Promise.resolve();
  }
  validate(resource){
    this.validated++;
    // console.log('Factory: Validating resource', resource);
    return Promise.resolve(true); // Assume valid by default
  }
}

test('Pool: min and max limit defaults', async () => {
  const resourceFactory = new TestResourceFactory();
  const pool = createPool(resourceFactory);
  assert.equal(pool.max, 1, 'Default max should be 1');
  assert.equal(pool.min, 0, 'Default min should be 0');
  // No operations that require cleanup for this specific test of defaults
});

test('Pool: basic acquire and release', async () => {
  const resourceFactory = new TestResourceFactory();
  const pool = createPool(resourceFactory, { max: 1, min: 0 });

  const resource1 = await pool.acquire();
  assert.ok(resource1 !== null && resource1 !== undefined, 'Acquired resource should not be null or undefined');
  assert.equal(resourceFactory.created, 1, 'Factory should have created 1 resource');
  assert.equal(pool.borrowed, 1, 'Pool should have 1 borrowed resource');
  assert.equal(pool.available, 0, 'Pool should have 0 available resources');

  pool.release(resource1);
  assert.equal(pool.borrowed, 0, 'Pool should have 0 borrowed resources after release');
  assert.equal(pool.available, 1, 'Pool should have 1 available resource after release');

  // Cleanup
  await pool.drain();
  await pool.clear();
  assert.equal(resourceFactory.destroyed, 1, 'Factory should have destroyed 1 resource after clear');
});

test('Pool: acquire respects max limit', async () => {
    const resourceFactory = new TestResourceFactory();
    // Explicitly set min to 0 to avoid auto-creation if default min was > 0
    const pool = createPool(resourceFactory, { max: 1, min: 0 });

    const r1 = await pool.acquire();
    assert.ok(r1, "First resource acquired");
    assert.equal(pool.borrowed, 1, "Pool has 1 borrowed resource");
    assert.equal(pool.pending, 0, "Pool has 0 pending requests initially");

    let acquireBlockedAndPending = true;
    let secondAcquireResolved = false;
    const acquirePromise = pool.acquire().then((r2) => {
        secondAcquireResolved = true;
        // console.log("Second acquire resolved with", r2);
        pool.release(r2); // Release the second resource immediately for cleanup
        return r2;
    }).catch(e => {
        console.error("Second acquire promise rejected", e);
        acquireBlockedAndPending = false; // No longer blocked if it errors
        throw e;
    });

    // Give some time for the acquire to potentially (incorrectly) resolve or update pending
    await new Promise(resolve => setTimeout(resolve, 100)); // Increased timeout slightly

    assert.equal(pool.pending, 1, "Pool should have 1 pending request");
    assert.equal(secondAcquireResolved, false, "Second acquire should still be blocked");

    pool.release(r1); // Release the first resource

    // console.log("Released r1, waiting for acquirePromise");
    await acquirePromise; // Now the second acquire should resolve

    assert.equal(secondAcquireResolved, true, "Second acquire should have resolved after release");
    // After second acquire resolves and immediately releases, borrowed should be 0
    // Need to wait for the release within acquirePromise to be processed.
    await new Promise(resolve => setTimeout(resolve, 50)); // give time for release in promise

    assert.equal(pool.borrowed, 0, "Pool should have 0 borrowed after second acquire and its release");
    assert.equal(pool.available, 1, "Pool should have 1 available after second acquire and its release");
    assert.equal(resourceFactory.created, 1, "Factory should still only have created 1 resource due to max limit and reuse");

    // Cleanup
    await pool.drain();
    await pool.clear();
    assert.equal(resourceFactory.destroyed, 1, "Factory should have destroyed 1 resource after clear");
});

test('Pool: destroy resource', async () => {
    const resourceFactory = new TestResourceFactory();
    const pool = createPool(resourceFactory, { max: 1, min: 0 });

    const resource = await pool.acquire();
    assert.equal(pool.borrowed, 1, "Resource is borrowed");
    assert.equal(resourceFactory.created, 1, "Resource created");

    await pool.destroy(resource);
    assert.equal(pool.borrowed, 0, "No resources borrowed after destroy");
    assert.equal(pool.available, 0, "No resources available after destroy");
    assert.equal(resourceFactory.destroyed, 1, "Resource destroyed by factory");
    assert.equal(pool.size, 0, "Pool size should be 0");

    // Cleanup (pool should be empty already)
    await pool.drain();
    await pool.clear();
});

test('Pool: use method correctly acquires and releases', async () => {
    const resourceFactory = new TestResourceFactory();
    const pool = createPool(resourceFactory, { max: 1, min: 0 });
    let resourceInUse = null;

    const result = await pool.use(async (resource) => {
        resourceInUse = resource;
        assert.ok(resource, "Resource provided to use function");
        assert.equal(pool.borrowed, 1, "Resource borrowed during use");
        return "use_result";
    });

    assert.equal(result, "use_result", "use method returns function result");
    assert.equal(pool.borrowed, 0, "Resource released after use");
    assert.equal(pool.available, 1, "Resource available after use");
    assert.equal(resourceFactory.created, 1, "Factory created one resource");

    // Cleanup
    await pool.drain();
    await pool.clear();
    assert.equal(resourceFactory.destroyed, 1, "Factory destroyed one resource");
});

test('Pool: use method correctly destroys resource on error', async () => {
    const resourceFactory = new TestResourceFactory();
    const pool = createPool(resourceFactory, { max: 1, min: 0 });
    const testError = new Error("Test error in use");

    try {
        await pool.use(async (resource) => {
            assert.ok(resource, "Resource provided to use function");
            assert.equal(pool.borrowed, 1, "Resource borrowed during use");
            throw testError;
        });
    } catch (e) {
        assert.equal(e, testError, "Correct error propagated from use");
    }

    assert.equal(pool.borrowed, 0, "Resource not borrowed after error in use");
    assert.equal(pool.available, 0, "Resource not available after error in use (should be destroyed)");
    assert.equal(pool.size, 0, "Pool size is 0 after error in use");
    assert.equal(resourceFactory.created, 1, "Factory created one resource");
    assert.equal(resourceFactory.destroyed, 1, "Factory destroyed one resource due to error");

    // Cleanup
    await pool.drain();
    await pool.clear();
});
console.log("tests.js loaded, runTests() will be called from test.html");
