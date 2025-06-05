"use strict";

export interface INode<T> {
  prev: INode<T> | null;
  next: INode<T> | null;
  data: T;
}

export class DoublyLinkedList<T> {
  private _head: INode<T> | null = null;
  private _tail: INode<T> | null = null;
  private _length: number = 0;

  public get head(): INode<T> | null {
    return this._head;
  }

  public get tail(): INode<T> | null {
    return this._tail;
  }

  public get length(): number {
    return this._length;
  }

  public insertBeginning(data: T): INode<T> {
    const node = DoublyLinkedList.createNode(data);
    if (this._head === null) {
      this._head = node;
      this._tail = node;
      this._length++;
    } else {
      this.insertBefore(this._head, node);
    }
    return node;
  }

  public insertEnd(data: T): INode<T> {
    const node = DoublyLinkedList.createNode(data);
    if (this._tail === null) {
      this.insertBeginning(data); // Will create a new node, so pass data
    } else {
      this.insertAfter(this._tail, node);
    }
    return node;
  }

  public insertAfter(node: INode<T>, newNode: INode<T>): void {
    if (node === null) { // Should not happen if called internally with valid node
        throw new Error("Reference node cannot be null");
    }
    newNode.prev = node;
    newNode.next = node.next;
    if (node.next === null) {
      this._tail = newNode;
    } else {
      node.next.prev = newNode;
    }
    node.next = newNode;
    this._length++;
  }

  public insertBefore(node: INode<T>, newNode: INode<T>): void {
    if (node === null) { // Should not happen if called internally with valid node
        throw new Error("Reference node cannot be null");
    }
    newNode.prev = node.prev;
    newNode.next = node;
    if (node.prev === null) {
      this._head = newNode;
    } else {
      node.prev.next = newNode;
    }
    node.prev = newNode;
    this._length++;
  }

  public remove(node: INode<T>): void {
    if (node === null) { // Should not happen if called internally with valid node
        throw new Error("Node to remove cannot be null");
    }
    if (node.prev === null) {
      this._head = node.next;
    } else {
      node.prev.next = node.next;
    }
    if (node.next === null) {
      this._tail = node.prev;
    } else {
      node.next.prev = node.prev;
    }
    node.prev = null;
    node.next = null;
    this._length--;
  }

  public getNode(index: number): INode<T> | null {
    if (index < 0 || index >= this._length) {
      return null;
    }
    let current = this._head;
    for (let i = 0; i < index; i++) {
      current = current!.next;
    }
    return current;
  }

  public static createNode<T>(data: T): INode<T> {
    return {
      prev: null,
      next: null,
      data: data
    };
  }
}
