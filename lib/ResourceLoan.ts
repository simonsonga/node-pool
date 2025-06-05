"use strict";

import { Deferred } from "./Deferred";
import { PooledResource } from "./PooledResource";

export class ResourceLoan<T> extends Deferred<void> {
  public readonly pooledResource: PooledResource<T>;
  private readonly _creationTimestamp: number;

  constructor(pooledResource: PooledResource<T>, PromiseCtor: PromiseConstructor = Promise) {
    super(PromiseCtor); // Deferred<void> as loans are typically resolved without a specific value
    this._creationTimestamp = Date.now();
    this.pooledResource = pooledResource;
  }

  /**
   * Resolves the loan. Indicates the resource is no longer in use by the borrower.
   */
  public resolve(): void {
    super.resolve(undefined); // Resolve with no value
  }

  /**
   * Rejects the loan. This is typically not used for resource loans,
   * as the pattern is to resolve when done or let the acquire timeout handle failure.
   * The original class had an empty reject method.
   * If explicit rejection is needed, its behavior should be defined.
   * For now, it will call super.reject but it's not part of the typical loan lifecycle.
   * @param reason The reason for rejection.
   */
  public reject(reason?: any): void {
    // super.reject(reason); // Or keep it empty if loans should not be rejectable by borrower
  }

  public get creationTimestamp(): number {
    return this._creationTimestamp;
  }
}
