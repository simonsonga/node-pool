"use strict";

import { Queue } from "./Queue";
import { ResourceRequest } from "./ResourceRequest"; // Assuming this will be typed

// Assuming ResourceRequest is the type of item stored in the Queue.
// If Queue can store various types, then T here should be generic.
// For now, let's assume T is compatible with what Queue expects.
// Based on Queue.ts, it expects items with a 'promise' property.

// If ResourceRequest is the concrete type, use it. Otherwise, define an interface.
interface Prioritizable {
  // Define properties of items that can be in PriorityQueue
  // This should align with what `Queue<T>` expects if `T` is this type.
  // For instance, if Queue<ResourceRequest> is used:
  promise: Promise<any>;
  // Add any other relevant properties from ResourceRequest
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
