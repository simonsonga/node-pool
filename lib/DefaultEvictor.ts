"use strict";

import { PooledResource } from "./PooledResource";

export interface IEvictionConfig {
  softIdleTimeoutMillis: number;
  idleTimeoutMillis: number;
  min: number; // min number of resources in the pool
}

export class DefaultEvictor {
  public evict<T>(
    config: IEvictionConfig,
    pooledResource: PooledResource<T>,
    availableObjectsCount: number
  ): boolean {
    // lastIdleTime can be null if the resource has never been idle (e.g. allocated immediately)
    // or if it's currently not idle. The evictor should only operate on idle resources.
    // We assume pooledResource passed here is currently in an IDLE state, thus lastIdleTime is non-null.
    if (pooledResource.lastIdleTime === null) {
        // This case should ideally not happen if evictor is called on idle resources.
        // If it can, the logic needs to define how to handle it.
        // For now, assume it's an invalid state for eviction or resource is not truly idle.
        return false;
    }

    const idleTime = Date.now() - pooledResource.lastIdleTime;

    if (
      config.softIdleTimeoutMillis > 0 &&
      config.softIdleTimeoutMillis < idleTime &&
      config.min < availableObjectsCount
    ) {
      return true;
    }

    // Ensure idleTimeoutMillis is positive before comparing
    if (config.idleTimeoutMillis > 0 && config.idleTimeoutMillis < idleTime) {
      return true;
    }

    return false;
  }
}
