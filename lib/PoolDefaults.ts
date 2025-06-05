"use strict";

export class PoolDefaults {
  public fifo: boolean = true;
  public priorityRange: number = 1;

  public testOnBorrow: boolean = false;
  public testOnReturn: boolean = false;

  public autostart: boolean = true;

  public evictionRunIntervalMillis: number = 0;
  public numTestsPerEvictionRun: number = 3;
  public softIdleTimeoutMillis: number = -1;
  public idleTimeoutMillis: number = 30000;

  public acquireTimeoutMillis: number | null = null;
  public destroyTimeoutMillis: number | null = null;
  public maxWaitingClients: number | null = null;

  public min: number | null = null;
  public max: number | null = null;

  public Promise: PromiseConstructor = Promise;
}
