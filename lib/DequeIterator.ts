"use strict";

import { DoublyLinkedList, INode } from "./DoublyLinkedList";
import { DoublyLinkedListIterator } from "./DoublyLinkedListIterator";

export class DequeIterator<T> extends DoublyLinkedListIterator<T> implements Iterator<T> {
  // The constructor from DoublyLinkedListIterator is inherited.
  // We need to ensure it's called correctly by Deque.
  // constructor(doublyLinkedList: DoublyLinkedList<T>, reverse: boolean = false) {
  //   super(doublyLinkedList, reverse);
  // }

  public next(): IteratorResult<T> {
    const result: IteratorResult<INode<T>> = super.next();

    // Unwrap the node data
    if (result.done) {
      return { value: undefined, done: true };
    }

    // result.value will be an INode<T> here if not done
    return { value: result.value.data, done: false };
  }

  // remove() and reset() methods are inherited from DoublyLinkedListIterator
  // and should work as expected, operating on INode<T>.
  // If DequeIterator needs to expose remove that operates on T,
  // it would require more complex logic or a different approach.
}
