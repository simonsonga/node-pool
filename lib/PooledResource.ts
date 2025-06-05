"use strict";

import { PooledResourceStateEnum } from "./PooledResourceStateEnum";

export class PooledResource<T> {
  public readonly creationTime: number;
  public lastReturnTime: number | null;
  public lastBorrowTime: number | null;
  public lastIdleTime: number | null;
  public obj: T;
  public state: PooledResourceStateEnum;

  constructor(resource: T) {
    this.creationTime = Date.now();
    this.lastReturnTime = null;
    this.lastBorrowTime = null;
    this.lastIdleTime = Date.now(); // Initialized to creation time as it's idle initially
    this.obj = resource;
    this.state = PooledResourceStateEnum.IDLE;
  }

  public allocate(): void {
    this.lastBorrowTime = Date.now();
    this.lastIdleTime = null; // No longer idle
    this.state = PooledResourceStateEnum.ALLOCATED;
  }

  public deallocate(): void {
    this.lastReturnTime = Date.now();
    this.lastIdleTime = Date.now(); // Becomes idle now
    this.state = PooledResourceStateEnum.IDLE;
  }

  public invalidate(): void {
    this.state = PooledResourceStateEnum.INVALID;
  }

  public test(): void {
    this.state = PooledResourceStateEnum.VALIDATION;
  }

  public idle(): void {
    this.lastIdleTime = Date.now();
    this.state = PooledResourceStateEnum.IDLE;
  }

  public returning(): void {
    this.state = PooledResourceStateEnum.RETURNING;
  }
}
