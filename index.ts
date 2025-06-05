"use strict";

import { Pool } from "./lib/Pool";
import { Deque } from "./lib/Deque";
import { PriorityQueue } from "./lib/PriorityQueue";
import { DefaultEvictor } from "./lib/DefaultEvictor";
import { IFactory } from "./lib/factoryValidator";
import { IPoolOptionsParams } from "./lib/PoolOptions";

// The Pool constructor expects:
// EvictorCls: new () => DefaultEvictor
// DequeCls: new <TVal>() => Deque<TVal>
// PriorityQueueCls: new <TVal extends Prioritizable>(priorityRange: number) => PriorityQueue<TVal>
//
// The imported DefaultEvictor, Deque, PriorityQueue are classes themselves,
// so they are constructor functions.

/**
 * Prioritizable interface placeholder for items that can be stored in PriorityQueue.
 * This should ideally be aligned with or imported from where PriorityQueue defines it,
 * or from a shared types file.
 * For the Pool's constructor, `ResourceRequest<T>` is used with `PriorityQueue`,
 * and `ResourceRequest<T>` has a `promise` property.
 */
interface Prioritizable {
  promise: Promise<any>;
}


/**
 * Creates a new generic resource pool.
 *
 * @template T The type of resource the pool will manage.
 * @param {IFactory<T>} factory The factory specification for producing and destroying resources.
 * @param {Partial<IPoolOptionsParams>} [config] Optional configuration settings for the pool.
 * @returns {Pool<T>} A new instance of the resource pool.
 */
export function createPool<T>(
  factory: IFactory<T>,
  config?: Partial<IPoolOptionsParams>
): Pool<T> {
  // The Pool constructor expects constructor functions.
  // DefaultEvictor, Deque, and PriorityQueue are classes, so they are constructor functions.
  // Need to ensure their constructor signatures match what Pool expects.
  // - DefaultEvictor: new () => DefaultEvictor (Matches)
  // - Deque: new <TVal>() => Deque<TVal> (Matches if Deque constructor is parameterless)
  // - PriorityQueue: new <TVal extends Prioritizable>(priorityRange: number) => PriorityQueue<TVal>
  //   (Matches if PriorityQueue constructor takes priorityRange)

  // The type arguments for Deque and PriorityQueue inside Pool constructor will be inferred
  // or set based on Pool's T.
  // For PriorityQueueCls, it's new <TVal extends Prioritizable>(priorityRange: number).
  // The Pool internally creates `new PriorityQueueCls<ResourceRequest<T>>(this._config.priorityRange)`.
  // This is fine as ResourceRequest<T> should be Prioritizable.
  return new Pool<T>(DefaultEvictor, Deque, PriorityQueue, factory, config);
}

export { Pool, Deque, PriorityQueue, DefaultEvictor, IFactory, IPoolOptionsParams };
