"use strict";

import { Deferred } from "./Deferred";
import { TimeoutError } from "./errors";

// fbind is not necessary with arrow functions or Function.prototype.bind
// const fbind = <T extends (...args: any[]) => any>(fn: T, ctx: ThisParameterType<T>): ((...args: Parameters<T>) => ReturnType<T>) => {
//   return function bound(...args: Parameters<T>): ReturnType<T> {
//     return fn.apply(ctx, args);
//   };
// };

export class ResourceRequest<T> extends Deferred<T> {
  private readonly _creationTimestamp: number;
  private _timerRef: ReturnType<typeof setTimeout> | null; // Use NodeJS.Timeout for Node, number for browsers

  constructor(timeoutMillis?: number | null, PromiseCtor: PromiseConstructor = Promise) {
    super(PromiseCtor);
    this._creationTimestamp = Date.now();
    this._timerRef = null;

    if (timeoutMillis !== undefined && timeoutMillis !== null) {
      this.setTimeout(timeoutMillis);
    }
  }

  public setTimeout(delay: number): void {
    if (this.state !== Deferred.PENDING) {
      return;
    }

    // Ensure delay is a positive integer
    const ttl = Math.floor(delay); // Similar to parseInt, but handles non-string inputs too
    if (isNaN(ttl) || ttl <= 0) {
      throw new Error("Delay must be a positive integer.");
    }

    const age = Date.now() - this._creationTimestamp;

    if (this._timerRef) {
      this.clearTimeout();
    }

    this._timerRef = setTimeout(
      () => this._fireTimeout(), // Arrow function preserves `this`
      Math.max(ttl - age, 0)
    );
  }

  public clearTimeout(): void {
    if (this._timerRef) {
      clearTimeout(this._timerRef);
    }
    this._timerRef = null;
  }

  private _fireTimeout(): void {
    // Ensure it only fires if still pending
    if (this.state === Deferred.PENDING) {
      this.reject(new TimeoutError("ResourceRequest timed out"));
    }
  }

  public reject(reason?: any): void {
    if (this.state === Deferred.PENDING) { // Ensure action only if pending
      this.clearTimeout();
      super.reject(reason);
    }
  }

  public resolve(value: T | PromiseLike<T>): void {
    if (this.state === Deferred.PENDING) { // Ensure action only if pending
      this.clearTimeout();
      super.resolve(value);
    }
  }

  public get creationTimestamp(): number {
    return this._creationTimestamp;
  }
}
