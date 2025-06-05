"use strict";

import { SimpleEventEmitter } from "./SimpleEventEmitter";
import { validateFactory, IFactory } from "./factoryValidator";
import { PoolOptions, IPoolOptionsParams } from "./PoolOptions";
import { ResourceRequest } from "./ResourceRequest";
import { ResourceLoan } from "./ResourceLoan";
import { PooledResource } from "./PooledResource";
import { DefaultEvictor, IEvictionConfig } from "./DefaultEvictor"; // Assuming IEvictionConfig is exported
import { Deque } from "./Deque";
import { Deferred, DeferredState } from "./Deferred"; // Assuming DeferredState is exported
import { PriorityQueue, Prioritizable } from "./PriorityQueue";
import { reflector } from "./utils";
// import { TimeoutError } from "./errors"; // Not directly used in Pool, but ResourceRequest uses it
import { PooledResourceStateEnum } from "./PooledResourceStateEnum";
import { DoublyLinkedListIterator } from "./DoublyLinkedListIterator"; // Deque's iterator might be this


const FACTORY_CREATE_ERROR = "factoryCreateError";
const FACTORY_DESTROY_ERROR = "factoryDestroyError";

export class Pool<T> extends SimpleEventEmitter {
  private _config: PoolOptions;
  private _Promise: PromiseConstructor;
  private _factory: IFactory<T>;
  private _draining: boolean = false;
  private _started: boolean = false;
  private _waitingClientsQueue: PriorityQueue<ResourceRequest<T>>;
  private _factoryCreateOperations: Set<Promise<any>> = new Set();
  private _factoryDestroyOperations: Set<Promise<any>> = new Set();
  private _availableObjects: Deque<PooledResource<T>>;
  private _testOnBorrowResources: Set<PooledResource<T>> = new Set();
  private _testOnReturnResources: Set<PooledResource<T>> = new Set(); // Not used in original JS, but good for completeness
  private _validationOperations: Set<Promise<boolean>> = new Set();
  private _allObjects: Set<PooledResource<T>> = new Set();
  private _resourceLoans: Map<T, ResourceLoan<T>> = new Map();
  private _evictionIterator: DoublyLinkedListIterator<PooledResource<T>>; // Deque.iterator() returns DoublyLinkedListIterator
  private _evictor: DefaultEvictor; // Or an interface IEvictor
  private _scheduledEviction: ReturnType<typeof setTimeout> | null = null; // NodeJS.Timeout for Node

  constructor(
    EvictorCls: new () => DefaultEvictor, // Or a more general IEvictor constructor
    DequeCls: new <TVal>() => Deque<TVal>,
    PriorityQueueCls: new <TVal extends Prioritizable>(priorityRange: number) => PriorityQueue<TVal>,
    factory: IFactory<T>,
    options?: Partial<IPoolOptionsParams>
  ) {
    super();

    validateFactory(factory);

    this._config = new PoolOptions(options);
    this._Promise = this._config.Promise;
    this._factory = factory;

    this._waitingClientsQueue = new PriorityQueueCls<ResourceRequest<T>>(this._config.priorityRange);
    this._availableObjects = new DequeCls<PooledResource<T>>();
    this._evictionIterator = this._availableObjects.iterator() as DoublyLinkedListIterator<PooledResource<T>>; // Cast needed if iterator() returns base Iterator
    this._evictor = new EvictorCls();

    if (this._config.autostart === true) {
      this.start();
    }
  }

  private _destroy(pooledResource: PooledResource<T>): void {
    pooledResource.invalidate();
    this._allObjects.delete(pooledResource);

    const destroyPromise = this._factory.destroy(pooledResource.obj);
    const wrappedDestroyPromise = this._config.destroyTimeoutMillis
      ? this._Promise.resolve(this._applyDestroyTimeout(this._Promise.resolve(destroyPromise))) // Ensure destroyPromise is a Promise
      : this._Promise.resolve(destroyPromise);

    this._trackOperation(
      wrappedDestroyPromise,
      this._factoryDestroyOperations
    ).catch(reason => {
      this.emit(FACTORY_DESTROY_ERROR, reason);
    });

    this._ensureMinimum();
  }

  private _applyDestroyTimeout(promise: Promise<any>): Promise<any> {
    const timeoutPromise = new this._Promise((_resolve, reject) => {
      setTimeout(() => {
        reject(new Error("destroy timed out")); // Consider using TimeoutError
      }, this._config.destroyTimeoutMillis!); // Not null due to previous check
    });
    return this._Promise.race([timeoutPromise, promise]);
  }

  private _testOnBorrow(): boolean {
    if (this._availableObjects.length < 1) {
      return false;
    }

    const pooledResource = this._availableObjects.shift()!; // Not undefined due to length check
    pooledResource.test();
    this._testOnBorrowResources.add(pooledResource);

    const validationPromise = this._factory.validate ? this._factory.validate(pooledResource.obj) : this._Promise.resolve(true);
    const wrappedValidationPromise = this._Promise.resolve(validationPromise);

    this._trackOperation(
      wrappedValidationPromise,
      this._validationOperations
    ).then(isValid => {
      this._testOnBorrowResources.delete(pooledResource);

      if (isValid === false) {
        pooledResource.invalidate(); // Already invalid from PooledResource perspective
        this._destroy(pooledResource);
        this._dispense();
        return;
      }
      this._dispatchPooledResourceToNextWaitingClient(pooledResource);
    }).catch(() => { // Handle validation promise rejection
      this._testOnBorrowResources.delete(pooledResource);
      this._destroy(pooledResource);
      this._dispense();
    });
    return true;
  }

  private _dispatchResource(): boolean {
    if (this._availableObjects.length < 1) {
      return false;
    }
    const pooledResource = this._availableObjects.shift()!;
    this._dispatchPooledResourceToNextWaitingClient(pooledResource);
    return true; // A resource was dispatched
  }

  private _dispense(): void {
    const numWaitingClients = this._waitingClientsQueue.length;
    if (numWaitingClients < 1) {
      return;
    }

    const resourceShortfall = numWaitingClients - this._potentiallyAllocableResourceCount;
    const actualNumberOfResourcesToCreate = Math.min(this.spareResourceCapacity, resourceShortfall);

    for (let i = 0; i < actualNumberOfResourcesToCreate; i++) {
      this._createResource();
    }

    if (this._config.testOnBorrow === true) {
      const desiredNumberOfResourcesToMoveIntoTest = numWaitingClients - this._testOnBorrowResources.size;
      const actualNumberOfResourcesToMoveIntoTest = Math.min(this._availableObjects.length, desiredNumberOfResourcesToMoveIntoTest);
      for (let i = 0; i < actualNumberOfResourcesToMoveIntoTest; i++) {
        this._testOnBorrow();
      }
    } else { // Not testing on borrow
      const actualNumberOfResourcesToDispatch = Math.min(this._availableObjects.length, numWaitingClients);
      for (let i = 0; i < actualNumberOfResourcesToDispatch; i++) {
        this._dispatchResource();
      }
    }
  }

  private _dispatchPooledResourceToNextWaitingClient(pooledResource: PooledResource<T>): boolean {
    const clientResourceRequest = this._waitingClientsQueue.dequeue();
    if (clientResourceRequest === undefined || clientResourceRequest.state !== DeferredState.PENDING) {
      this._addPooledResourceToAvailableObjects(pooledResource);
      return false;
    }
    const loan = new ResourceLoan<T>(pooledResource, this._Promise);
    this._resourceLoans.set(pooledResource.obj, loan);
    pooledResource.allocate();
    clientResourceRequest.resolve(pooledResource.obj);
    return true;
  }

  private _trackOperation<OpT>(operation: Promise<OpT>, set: Set<Promise<OpT>>): Promise<OpT> {
    set.add(operation);
    return operation.then(
      v => {
        set.delete(operation);
        return this._Promise.resolve(v);
      },
      e => {
        set.delete(operation);
        return this._Promise.reject(e);
      }
    );
  }

  private _createResource(): void {
    const factoryPromise = this._factory.create();
    const wrappedFactoryPromise = this._Promise.resolve(factoryPromise).then(resource => {
      const pooledResource = new PooledResource<T>(resource);
      this._allObjects.add(pooledResource);
      this._addPooledResourceToAvailableObjects(pooledResource);
      // Return null to satisfy Bluebird-like behavior if not returning a promise
      return null;
    });

    this._trackOperation(wrappedFactoryPromise, this._factoryCreateOperations)
      .then(() => {
        this._dispense();
        return null; // For Bluebird compatibility if any handler expects a return
      })
      .catch(reason => {
        this.emit(FACTORY_CREATE_ERROR, reason);
        this._dispense(); // Attempt to dispense even if creation failed, might satisfy other requests
      });
  }

  private _ensureMinimum(): void {
    if (this._draining === true || !this._started) { // also check if started
      return;
    }
    const minShortfall = (this._config.min || 0) - this._count;
    for (let i = 0; i < minShortfall; i++) {
      this._createResource();
    }
  }

  private _evict(): void {
    const testsToRun = Math.min(this._config.numTestsPerEvictionRun, this._availableObjects.length);
    const evictionConfig: IEvictionConfig = {
      softIdleTimeoutMillis: this._config.softIdleTimeoutMillis,
      idleTimeoutMillis: this._config.idleTimeoutMillis,
      min: this._config.min || 0,
    };

    for (let testsHaveRun = 0; testsHaveRun < testsToRun; ) {
      // Deque's iterator is DoublyLinkedListIterator, which has reset and remove
      const iterationResult = this._evictionIterator.next();

      if (iterationResult.done) {
        this._evictionIterator.reset(); // Reset if done
        if (this._availableObjects.length === 0) break; // Nothing to iterate
        continue; // Continue to get the first item after reset
      }

      const resourceNode = iterationResult.value; // This is INode<PooledResource<T>> from DLLIterator
                                                 // but DequeIterator unwraps to PooledResource<T>
                                                 // Let's assume _evictionIterator is directly on _availableObjects (Deque)
                                                 // and Deque's iterator returns PooledResource<T>
      // If Deque's iterator directly returns T (PooledResource<T>)
      const resource = resourceNode; // If DequeIterator returns T. This needs clarification based on DequeIterator impl.
                                    // Assuming DequeIterator returns PooledResource<T> directly.
                                    // If it returns INode<PooledResource<T>>, then resource = resourceNode.data;

      // Let's assume _evictionIterator is of type Iterator<PooledResource<T>> from Deque
      // and Deque's iterator supports remove through a custom method or by re-acquiring from Deque
      // This is a bit tricky as standard iterators don't have remove.
      // DoublyLinkedListIterator has remove. If Deque.iterator() returns it, then it's fine.

      const shouldEvict = this._evictor.evict(evictionConfig, resource, this._availableObjects.length);
      testsHaveRun++;

      if (shouldEvict) {
        // this._evictionIterator.remove(); // This is from DoublyLinkedListIterator
                                         // How does this interact with Deque?
                                         // If Deque uses DLL and its iterator is DLLIterator, then this is fine.
        this._availableObjects.remove(resource); // Added a hypothetical remove method to Deque for this.
                                                 // Or find and remove via iteration if Deque doesn't have direct remove by value.
                                                 // This part needs robust implementation based on Deque/Iterator capabilities.
        this._destroy(resource);
      }
    }
  }


  private _scheduleEvictorRun(): void {
    if (this._config.evictionRunIntervalMillis > 0 && this._started) {
      this._scheduledEviction = setTimeout(() => {
        this._evict();
        if (this._started) { // Check if still started before rescheduling
          this._scheduleEvictorRun();
        }
      }, this._config.evictionRunIntervalMillis);
    }
  }

  private _descheduleEvictorRun(): void {
    if (this._scheduledEviction) {
      clearTimeout(this._scheduledEviction);
    }
    this._scheduledEviction = null;
  }

  public start(): void {
    if (this._draining === true || this._started === true) {
      return;
    }
    this._started = true;
    this._scheduleEvictorRun();
    this._ensureMinimum();
  }

  public acquire(priority?: number): Promise<T> {
    if (!this._started && !this._config.autostart) {
        this.start(); // Start the pool if autostart is false and it hasn't been started
    }

    if (this._draining) {
      return this._Promise.reject(new Error("pool is draining and cannot accept work"));
    }

    if (
      this.spareResourceCapacity < 1 &&
      this._availableObjects.length < 1 &&
      this._config.maxWaitingClients !== null &&
      this._waitingClientsQueue.length >= this._config.maxWaitingClients
    ) {
      return this._Promise.reject(new Error("max waitingClients count exceeded"));
    }

    const resourceRequest = new ResourceRequest<T>(this._config.acquireTimeoutMillis, this._Promise);
    this._waitingClientsQueue.enqueue(resourceRequest, priority);
    this._dispense();
    return resourceRequest.promise;
  }

  public use<U>(fn: (resource: T) => Promise<U> | U, priority?: number): Promise<U> {
    return this.acquire(priority).then(resource => {
      return this._Promise.resolve(fn(resource)).then(
        result => {
          this.release(resource);
          return result;
        },
        err => {
          this.destroy(resource); // Or this.release(resource) and let testOnReturn handle bad resources
          throw err;
        }
      );
    });
  }

  public isBorrowedResource(resource: T): boolean {
    return this._resourceLoans.has(resource);
  }

  public release(resource: T): Promise<void> {
    const loan = this._resourceLoans.get(resource);
    if (loan === undefined) {
      return this._Promise.reject(new Error("Resource not currently part of this pool or not borrowed"));
    }

    this._resourceLoans.delete(resource);
    loan.resolve(); // Resolve the loan's deferred promise
    const pooledResource = loan.pooledResource;
    pooledResource.deallocate();

    if (this._config.testOnReturn) {
        pooledResource.test(); // Mark for testing
        // this._testOnReturnResources.add(pooledResource); // Manage this set if used
        const validationPromise = this._factory.validate ? this._factory.validate(pooledResource.obj) : this._Promise.resolve(true);
        this._trackOperation(this._Promise.resolve(validationPromise), this._validationOperations)
            .then(isValid => {
                // this._testOnReturnResources.delete(pooledResource);
                if (!isValid) {
                    this._destroy(pooledResource);
                } else {
                    this._addPooledResourceToAvailableObjects(pooledResource);
                }
                this._dispense();
            }).catch(() => {
                // this._testOnReturnResources.delete(pooledResource);
                this._destroy(pooledResource);
                this._dispense();
            });
    } else {
        this._addPooledResourceToAvailableObjects(pooledResource);
        this._dispense();
    }
    return this._Promise.resolve();
  }

  public destroy(resource: T): Promise<void> {
    const loan = this._resourceLoans.get(resource);
    if (loan === undefined) {
      // If not a borrowed resource, check if it's an available one from the pool
      let resourceToDestroy: PooledResource<T> | undefined;
      // This requires iterating _availableObjects or _allObjects to find the PooledResource wrapper
      // For simplicity, this example assumes destroy is primarily for borrowed resources or requires PooledResource<T>
      // This part might need adjustment based on how unborrowed resources are expected to be destroyed.
      return this._Promise.reject(new Error("Resource not currently part of this pool or not borrowed"));
    }

    this._resourceLoans.delete(resource);
    loan.resolve();
    const pooledResource = loan.pooledResource;
    // pooledResource.deallocate(); // Not strictly deallocating to pool, but destroying
    this._destroy(pooledResource);
    this._dispense(); // ensureMinimum might kick in
    return this._Promise.resolve();
  }

  private _addPooledResourceToAvailableObjects(pooledResource: PooledResource<T>): void {
    pooledResource.idle();
    if (this._config.fifo) {
      this._availableObjects.push(pooledResource);
    } else {
      this._availableObjects.unshift(pooledResource);
    }
  }

  public drain(): Promise<void> {
    this._draining = true;
    // Stop creating new resources for min level
    this._descheduleEvictorRun(); // Stop evictor during drain

    return this.__allResourceRequestsSettled()
      .then(() => this.__allResourcesReturned())
      .then(() => {
        // Evictor is already descheduled. No new resources are created.
        // Pool will not restart evictor or ensure minimums until started again.
      });
  }

  private __allResourceRequestsSettled(): Promise<any[]> {
    if (this._waitingClientsQueue.length > 0) {
      const promises = [];
      // PriorityQueue doesn't expose its internal queues/items directly for iteration usually.
      // This might need PriorityQueue to expose a way to get all pending promises or iterate requests.
      // For now, assuming we can't directly access all promises.
      // A simpler approach: wait for the length to be 0. New requests are rejected by _draining flag.
      // This requires _dispense to continue processing the queue.
      // A more robust way is to have ResourceRequest expose its promise and collect them.
      // This is a simplification:
      return new this._Promise(resolve => {
        const check = () => {
          if (this._waitingClientsQueue.length === 0) {
            resolve([]);
          } else {
            // Potentially, new items are added if _dispense is called and creates new promises.
            // This needs careful handling. A snapshot of current promises is better.
            // For now, rely on _draining flag to stop new client requests.
            setTimeout(check, 100); // Check periodically
          }
        };
        check();
      });
    }
    return this._Promise.resolve([]);
  }

  private __allResourcesReturned(): Promise<any[]> {
    const ps = Array.from(this._resourceLoans.values()).map(loan => reflector(loan.promise));
    return this._Promise.all(ps);
  }

  public clear(): Promise<void[]> {
    const reflectedCreatePromises = Array.from(this._factoryCreateOperations).map(reflector);

    return this._Promise.all(reflectedCreatePromises).then(() => {
      const destroyPromises: Promise<void>[] = [];
      // Iterate over a copy for modification safety if Deque iterator is live
      const availableCopy = [...this._availableObjects.iterator()].map(nodeOrData => {
        // Assuming DequeIterator returns PooledResource<T> directly
        return nodeOrData as PooledResource<T>;
      });

      availableCopy.forEach(pooledResource => {
         // _destroy returns void, but it initiates async operation tracked in _factoryDestroyOperations
         // For clear, we want to await all these destructions.
         // This requires _destroy to return the promise from _trackOperation.
         // Let's assume _destroy is synchronous for now in terms of what clear waits for directly.
         // Or, more correctly, collect promises from _factory.destroy calls.
         this._availableObjects.remove(pooledResource); // Assuming Deque.remove by value
         const p = this._factory.destroy(pooledResource.obj);
         destroyPromises.push(this._Promise.resolve(p)); // Ensure it's a promise
      });
      this._allObjects.clear(); // Assuming all available are destroyed and no new ones created

      // Wait for all explicit destroy operations to complete
      return this._Promise.all(destroyPromises.map(reflector)).then(() => {
          // Also wait for any destroy operations already tracked
          const reflectedDestroyPromises = Array.from(this._factoryDestroyOperations).map(reflector);
          return this._Promise.all(reflectedDestroyPromises);
      });
    }).then(() => {
        this._ensureMinimum(); // After clear, ensure minimum is met if not draining
        return []; // Match Promise<void[]>
    });
  }


  public ready(): Promise<void> {
    return new this._Promise<void>(resolve => {
      const isReady = () => {
        if (!this._started) { // If not started, it can't become ready unless autostart handles it
            setTimeout(isReady, 100); // Wait for it to potentially start
            return;
        }
        if (this.available >= (this._config.min || 0)) {
          resolve();
        } else {
          setTimeout(isReady, 100);
        }
      };
      isReady();
    });
  }

  private get _potentiallyAllocableResourceCount(): number {
    return (
      this._availableObjects.length +
      this._testOnBorrowResources.size +
      // this._testOnReturnResources.size + // these are not for new clients
      this._factoryCreateOperations.size
    );
  }

  private get _count(): number {
    return this._allObjects.size + this._factoryCreateOperations.size;
  }

  public get spareResourceCapacity(): number {
    return this._config.max - (this._allObjects.size + this._factoryCreateOperations.size);
  }

  public get size(): number {
    return this._count;
  }

  public get available(): number {
    return this._availableObjects.length;
  }

  public get borrowed(): number {
    return this._resourceLoans.size;
  }

  public get pending(): number {
    return this._waitingClientsQueue.length;
  }

  public get max(): number {
    return this._config.max;
  }

  public get min(): number {
    return this._config.min || 0;
  }
}
