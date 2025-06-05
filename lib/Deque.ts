"use strict";

import { DoublyLinkedList, INode } from "./DoublyLinkedList";
import { DequeIterator } from "./DequeIterator"; // Will be created next

export class Deque<T> {
  private _list: DoublyLinkedList<T>;

  constructor() {
    this._list = new DoublyLinkedList<T>();
  }

  public shift(): T | undefined {
    if (this.length === 0) {
      return undefined;
    }
    // head cannot be null here due to length check
    const node = this._list.head!;
    this._list.remove(node);
    return node.data;
  }

  public unshift(element: T): void {
    // DoublyLinkedList.insertBeginning now takes data and creates node internally
    this._list.insertBeginning(element);
  }

  public push(element: T): void {
    // DoublyLinkedList.insertEnd now takes data and creates node internally
    this._list.insertEnd(element);
  }

  public pop(): T | undefined {
    if (this.length === 0) {
      return undefined;
    }
    // tail cannot be null here due to length check
    const node = this._list.tail!;
    this._list.remove(node);
    return node.data;
  }

  public [Symbol.iterator](): Iterator<INode<T>> {
    return new DequeIterator<T>(this._list);
  }

  public iterator(): Iterator<INode<T>> {
    return new DequeIterator<T>(this._list);
  }

  public reverseIterator(): Iterator<INode<T>> {
    return new DequeIterator<T>(this._list, true);
  }

  public get head(): T | undefined {
    if (this.length === 0 || !this._list.head) {
      return undefined;
    }
    return this._list.head.data;
  }

  public get tail(): T | undefined {
    if (this.length === 0 || !this._list.tail) {
      return undefined;
    }
    return this._list.tail.data;
  }

  public get length(): number {
    return this._list.length;
  }

  // Method to get internal list if needed by DequeIterator, or pass nodes directly
  /** @internal */
  public getInternalList(): DoublyLinkedList<T> {
    return this._list;
  }
}
