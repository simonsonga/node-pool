"use strict";

export interface IFactory<T> {
  create: () => Promise<T> | T;
  destroy: (resource: T) => Promise<void> | void;
  validate?: (resource: T) => Promise<boolean> | boolean;
}

export function validateFactory<T>(factory: IFactory<T>): void {
  if (typeof factory.create !== "function") {
    throw new TypeError("factory.create must be a function");
  }

  if (typeof factory.destroy !== "function") {
    throw new TypeError("factory.destroy must be a function");
  }

  if (
    typeof factory.validate !== "undefined" &&
    typeof factory.validate !== "function"
  ) {
    throw new TypeError("factory.validate must be a function if provided");
  }
}
