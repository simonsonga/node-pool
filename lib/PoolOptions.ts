"use strict";

import { PoolDefaults } from "./PoolDefaults";

export interface IPoolOptionsParams {
  fifo?: boolean;
  priorityRange?: number;
  testOnBorrow?: boolean;
  testOnReturn?: boolean;
  autostart?: boolean;
  acquireTimeoutMillis?: number;
  destroyTimeoutMillis?: number;
  maxWaitingClients?: number;
  min?: number;
  max?: number;
  evictionRunIntervalMillis?: number;
  numTestsPerEvictionRun?: number;
  softIdleTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  Promise?: PromiseConstructor;
}

export class PoolOptions {
  public fifo: boolean;
  public priorityRange: number;
  public testOnBorrow: boolean;
  public testOnReturn: boolean;
  public autostart: boolean;
  public acquireTimeoutMillis: number | null;
  public destroyTimeoutMillis: number | null;
  public maxWaitingClients: number | null;
  public min: number;
  public max: number;
  public evictionRunIntervalMillis: number;
  public numTestsPerEvictionRun: number;
  public softIdleTimeoutMillis: number;
  public idleTimeoutMillis: number;
  public Promise: PromiseConstructor;

  constructor(opts: IPoolOptionsParams = {}) {
    const poolDefaults = new PoolDefaults();

    this.fifo = typeof opts.fifo === "boolean" ? opts.fifo : poolDefaults.fifo;
    this.priorityRange = opts.priorityRange !== undefined ? opts.priorityRange : poolDefaults.priorityRange;

    this.testOnBorrow = typeof opts.testOnBorrow === "boolean" ? opts.testOnBorrow : poolDefaults.testOnBorrow;
    this.testOnReturn = typeof opts.testOnReturn === "boolean" ? opts.testOnReturn : poolDefaults.testOnReturn;

    this.autostart = typeof opts.autostart === "boolean" ? opts.autostart : poolDefaults.autostart;

    this.acquireTimeoutMillis = opts.acquireTimeoutMillis !== undefined ? opts.acquireTimeoutMillis : poolDefaults.acquireTimeoutMillis;
    this.destroyTimeoutMillis = opts.destroyTimeoutMillis !== undefined ? opts.destroyTimeoutMillis : poolDefaults.destroyTimeoutMillis;

    this.maxWaitingClients = opts.maxWaitingClients !== undefined ? opts.maxWaitingClients : poolDefaults.maxWaitingClients;

    const defaultMax = poolDefaults.max !== null ? poolDefaults.max : 1;
    const defaultMin = poolDefaults.min !== null ? poolDefaults.min : 0;

    this.max = opts.max !== undefined ? Math.max(opts.max, 1) : defaultMax;
    this.min = opts.min !== undefined ? Math.min(Math.max(opts.min, 0), this.max) : defaultMin;
    // Ensure min is not greater than max
    if (this.min > this.max) {
      this.min = this.max;
    }


    this.evictionRunIntervalMillis = opts.evictionRunIntervalMillis !== undefined ? opts.evictionRunIntervalMillis : poolDefaults.evictionRunIntervalMillis;
    this.numTestsPerEvictionRun = opts.numTestsPerEvictionRun !== undefined ? opts.numTestsPerEvictionRun : poolDefaults.numTestsPerEvictionRun;
    this.softIdleTimeoutMillis = opts.softIdleTimeoutMillis !== undefined ? opts.softIdleTimeoutMillis : poolDefaults.softIdleTimeoutMillis;
    this.idleTimeoutMillis = opts.idleTimeoutMillis !== undefined ? opts.idleTimeoutMillis : poolDefaults.idleTimeoutMillis;

    this.Promise = opts.Promise !== undefined ? opts.Promise : poolDefaults.Promise;
  }
}
