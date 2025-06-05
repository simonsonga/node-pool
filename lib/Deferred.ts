"use strict";

type ResolveFunction<T> = (value: T | PromiseLike<T>) => void;
type RejectFunction = (reason?: any) => void;

enum DeferredState {
  PENDING = "PENDING",
  FULFILLED = "FULFILLED",
  REJECTED = "REJECTED"
}

export class Deferred<T> {
  private _state: DeferredState;
  private _resolve!: ResolveFunction<T>; // Definite assignment assertion
  private _reject!: RejectFunction; // Definite assignment assertion
  private _promise: Promise<T>;

  static readonly PENDING = DeferredState.PENDING;
  static readonly FULFILLED = DeferredState.FULFILLED;
  static readonly REJECTED = DeferredState.REJECTED;

  constructor(PromiseExecutor: PromiseConstructor = Promise) {
    this._state = DeferredState.PENDING;
    this._promise = new PromiseExecutor<T>((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  get state(): DeferredState {
    return this._state;
  }

  get promise(): Promise<T> {
    return this._promise;
  }

  reject(reason?: any): void {
    if (this._state !== DeferredState.PENDING) {
      return;
    }
    this._state = DeferredState.REJECTED;
    this._reject(reason);
  }

  resolve(value: T | PromiseLike<T>): void {
    if (this._state !== DeferredState.PENDING) {
      return;
    }
    this._state = DeferredState.FULFILLED;
    this._resolve(value);
  }
}
