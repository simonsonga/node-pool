"use strict";

import { DoublyLinkedList, INode } from "./DoublyLinkedList";

export class DoublyLinkedListIterator<T> implements Iterator<INode<T>> {
  private _list: DoublyLinkedList<T>;
  private _direction: "prev" | "next";
  private _startPosition: "head" | "tail";
  private _started: boolean = false;
  private _cursor: INode<T> | null = null;
  private _done: boolean = false;

  constructor(doublyLinkedList: DoublyLinkedList<T>, reverse: boolean = false) {
    this._list = doublyLinkedList;
    this._direction = reverse ? "prev" : "next";
    this._startPosition = reverse ? "tail" : "head";
  }

  private _advanceCursor(): void {
    if (this._started === false) {
      this._started = true;
      this._cursor = this._list[this._startPosition];
      return;
    }
    if (this._cursor) {
      this._cursor = this._cursor[this._direction];
    }
  }

  public reset(): void {
    this._done = false;
    this._started = false;
    this._cursor = null;
  }

  public remove(): void {
    if (
      this._started === false ||
      this._done === true ||
      this._cursor === null || // Ensure cursor is not null before checking if detached
      this._isCursorDetached()
    ) {
      // Or throw an error, depending on desired behavior for invalid remove attempt
      return;
    }
    this._list.remove(this._cursor);
    // Consider how cursor should behave after remove.
    // For simplicity, let's not try to re-position it. User should be aware.
    // Or, could try to set it to the node before/after the removed one,
    // but that complicates logic, especially with list ends.
  }

  public next(): IteratorResult<INode<T>> {
    if (this._done) {
      return { value: undefined, done: true };
    }

    this._advanceCursor();

    if (this._cursor === null || this._isCursorDetached()) {
      this._done = true;
      return { value: undefined, done: true };
    }

    return {
      value: this._cursor,
      done: false
    };
  }

  private _isCursorDetached(): boolean {
    if (!this._cursor) {
      return true; // A null cursor is effectively detached or at an invalid state for this check
    }
    // A node is detached if it's not the head or tail, and has no prev or next.
    // This check is more robust if the list itself is also empty.
    const isTrulyOrphaned =
      this._cursor.prev === null &&
      this._cursor.next === null &&
      this._list.tail !== this._cursor &&
      this._list.head !== this._cursor;

    // If the list is empty, any non-null cursor would be considered detached by the above.
    // However, if the list becomes empty, the cursor should ideally become null.
    if (this._list.length === 0 && this._cursor !== null) {
        return true;
    }

    return isTrulyOrphaned;
  }
}
