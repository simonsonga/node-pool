"use strict";

import { Queue } from "./Queue";
// ResourceRequest is not directly used here, but Prioritizable often aligns with it.
// import { ResourceRequest } from "./ResourceRequest";

// If ResourceRequest is the concrete type, use it. Otherwise, define an interface.
// This interface defines the minimum requirement for items to be prioritizable in the queue,
// particularly if the queue or its underlying structures (like Pool's use of ResourceRequest)
// expect certain properties.
export interface Prioritizable {
  // The primary property ResourceRequest has that PriorityQueue relies on via Pool's usage
  // is that it's a Deferred, which has a `promise` property.
  promise: Promise<any>;
  // Add any other properties if the PriorityQueue's logic itself depends on them,
  // though typically it only cares about managing items of type T.
  // The constraint `T extends Prioritizable` is more for the user of PriorityQueue (e.g., Pool)
  // to ensure that items passed to it are compatible with its expected usage pattern.
}

export class PriorityQueue<T extends Prioritizable> {
  private _size: number;
  private _slots: Array<Queue<T>>;

  constructor(size: number) {
    this._size = Math.max(size | 0, 1);
    this._slots = [];
    for (let i = 0; i < this._size; i++) {
      // Each slot is a Queue that can hold items of type T
      this._slots.push(new Queue<T>());
    }
  }

  public get length(): number {
    let totalLength = 0;
    for (let i = 0; i < this._slots.length; i++) {
      totalLength += this._slots[i].length;
    }
    return totalLength;
  }

  public enqueue(obj: T, priority?: number): void {
    let resolvedPriority = (priority && +priority | 0) || 0;

    if (resolvedPriority < 0 || resolvedPriority >= this._size) {
      resolvedPriority = this._size - 1; // Assign to the lowest priority queue
    }
    this._slots[resolvedPriority].push(obj);
  }

  public dequeue(): T | undefined {
    for (let i = 0; i < this._slots.length; i++) {
      if (this._slots[i].length > 0) {
        return this._slots[i].shift();
      }
    }
    return undefined;
  }

  public get head(): T | undefined {
    for (let i = 0; i < this._slots.length; i++) {
      if (this._slots[i].length > 0) {
        return this._slots[i].head;
      }
    }
    return undefined;
  }

  public get tail(): T | undefined {
    for (let i = this._slots.length - 1; i >= 0; i--) {
      if (this._slots[i].length > 0) {
        return this._slots[i].tail;
      }
    }
    return undefined;
  }
}
