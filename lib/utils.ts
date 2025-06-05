"use strict";

function noop(): void {}

/**
 * Reflects a promise but does not expose any
 * underlying value or rejection from that promise.
 * @param  {Promise<any>} promise
 * @return {Promise<void>}
 */
export function reflector(promise: Promise<any>): Promise<void> {
  return promise.then(noop, noop);
}
