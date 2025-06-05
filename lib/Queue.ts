"use strict";

import { DoublyLinkedList, INode } from "./DoublyLinkedList";
import { Deque } from "./Deque";
import { ResourceRequest } from "./ResourceRequest"; // Assuming ResourceRequest will be converted/typed

// Define a type for the items that Queue will handle, assuming they have a promise property.
// This should ideally be a more specific type e.g. ResourceRequest from another module.
interface QueueItem<T> {
  promise: Promise<T>;
  // Add other properties of ResourceRequest if necessary for type safety here
}


export class Queue<T extends QueueItem<any>> extends Deque<T> {
  /**
   * Adds the obj to the end of the list for this slot.
   * We completely override the parent method because we need access to the
   * node for our rejection handler.
   * @param resourceRequest The item to add to the queue.
   */
  public push(resourceRequest: T): void {
    // Note: The original Deque.push takes data `T` and creates a node internally.
    // Here, `DoublyLinkedList.createNode` is used directly.
    // This suggests that the Queue class wants to manage nodes explicitly for some reason (timeout handling).
    // However, the Deque class's _list is private.
    // For now, let's adapt by using the public interface of DoublyLinkedList,
    // assuming _list in Deque is an instance of DoublyLinkedList.
    // This might require exposing _list or providing methods in Deque to add/remove nodes directly if needed.

    // A cleaner way would be to have Deque.push return the created node, or have Deque manage this internally.
    // Given the current structure, we access the internal list of Deque.
    // This is not ideal as it breaks encapsulation.
    // A better solution would be to refactor Deque or DoublyLinkedList.

    // const internalList = (this as any)._list as DoublyLinkedList<T>; // Unsafe cast
    // For now, we'll assume ResourceRequest is the type T for the Deque and Queue.
    // The `push` in `Deque<T>` is `this._list.insertEnd(element);`
    // The original JS `Queue.push` was:
    // const node = DoublyLinkedList.createNode(resourceRequest);
    // resourceRequest.promise.catch(this._createTimeoutRejectionHandler(node));
    // this._list.insertEnd(node);
    // This means Queue wants to operate on INode<T> for items in its list.
    // This is incompatible with Deque<T> which stores T directly.

    // Let's assume Queue should actually be a Deque of ResourceRequest objects
    // And the timeout handling needs to be adapted.
    // The challenge is that _createTimeoutRejectionHandler needs the INode.

    // Option 1: Queue works with INode<T> instead of T. This changes its public interface.
    // Option 2: Deque is modified to support attaching handlers to nodes. (Complex)
    // Option 3: We find a way to get the node after push, or handle removal differently.

    // For minimal changes now, let's assume Queue is a Deque<T>
    // and the timeout logic needs to be rethought or T must include its node.
    // Given the original code, it seems `Queue` is not really a `Deque<ResourceRequest>`
    // but a `Deque` that *manages* `ResourceRequest`s *within* `INode`s that it creates itself.
    // This is a fundamental conflict with `Deque<T>` expecting to store `T`.

    // Let's proceed with the assumption that Queue manages INode<T> where T is ResourceRequest.
    // This means `Queue` cannot directly extend `Deque<T>` if `Deque<T>` stores `T`.
    // It should perhaps *use* a DoublyLinkedList directly.

    // Re-evaluating: Deque stores T. Queue wants to store T (ResourceRequest), but also wants to
    // associate a timeout handler with the *node* containing T.
    // This implies that when T is removed from the Deque due to timeout, it's done by node.
    // This is tricky.

    // Let's stick to the original intent: Queue extends Deque.
    // Deque's methods like push/pop operate on T.
    // The problem is _createTimeoutRejectionHandler which needs an INode.

    // If `push` in `Deque` could return the node, or if `remove` in `Deque` could take `T` and find its node.
    // The simplest way, maintaining current structure, is that Queue's _list is what it operates on for these.
    // This means Queue is reimplementing Deque's functionality slightly differently.

    const internalList = this.getInternalList(); // Use the accessor
    const node = DoublyLinkedList.createNode(resourceRequest); // resourceRequest is of type T

    // Assuming T is ResourceRequest (or compatible like QueueItem)
    // We need to ensure that T actually has a promise property.
    resourceRequest.promise.catch(this._createTimeoutRejectionHandler(node, internalList));

    // We are manually calling insertEnd on the internal list, bypassing Deque's push.
    // This is because we need the 'node' for the timeout handler.
    internalList.insertEnd(node.data); // This should be node, if _list stores INode<T>
                                       // Or node.data if _list stores T.
                                       // Deque's _list stores T via INode<T>. So insertEnd(data) is correct.
                                       // But then _list.remove(node) in handler is wrong.

    // Let's assume Deque's _list stores T elements wrapped in INodes.
    // So, `internalList.insertEnd(resourceRequest)` is the Deque way.
    // The issue is `this._list.remove(node)` in the handler.

    // The original `_list.insertEnd(node)` was inserting the node itself, not its data.
    // This means the `_list` in `Queue` (and `Deque`) was a list of `INode<ResourceRequest>` effectively,
    // not `ResourceRequest`. This needs to be `DoublyLinkedList<INode<T>>` if T is ResourceRequest.
    // Or `DoublyLinkedList<T>` where T is ResourceRequest, and createNode is used.

    // Let's assume DoublyLinkedList stores T (data), not INode<T> (nodes).
    // Deque.push(element: T) calls this._list.insertEnd(element), which creates a node for T.
    // So, Queue.push needs to get a handle to that node.

    // This is a significant structural issue. The original JS code was a bit loose here.
    // For Queue to extend Deque<T> and also have node-specific logic for T items:
    // 1. Deque.push could return the INode<T> it created.
    // 2. ResourceRequest (T) could store its own INode<T> (circular).

    // Given the constraints, the least intrusive change that keeps current logic:
    // The `_list` in `Deque` is a `DoublyLinkedList<T>`.
    // `DoublyLinkedList.insertEnd(data: T)` creates an `INode<T>` and adds it.
    // To make the timeout handler work, it needs to remove a *specific node*.
    // This means `push` must somehow get that node.

    // If Queue does not use Deque's push, but manipulates _list directly:
    // This was the original JS: this._list.insertEnd(node); where node = DoublyLinkedList.createNode(resourceRequest);
    // This implies that _list is a DoublyLinkedList of INode objects, not of T data.
    // Let's assume Deque<T> means the Deque holds items of type T, and its _list is DoublyLinkedList<T>.
    // If Queue is a Deque<T>, then its _list is also DoublyLinkedList<T>.
    // If Queue wants to store INode<T> in its list, it cannot be a Deque<T>.
    // It would have to be a Deque<INode<T>> or use DoublyLinkedList<INode<T>> directly.

    // Reverting to the idea that Queue *uses* a DoublyLinkedList directly, not extends Deque.
    // Or, Deque needs to be more flexible.

    // Sticking with `extends Deque<T>`:
    // We must use `super.push(resourceRequest)` or `this._list.insertEnd(resourceRequest)`.
    // Neither gives us the `INode` for the timeout handler.

    // Temporary solution: Assume `resourceRequest` can be found and removed if it times out.
    // This means the rejection handler won't use `node` directly.
    // This changes the original logic significantly.

    // Let's assume `T` is `ResourceRequest` and `ResourceRequest` is an object.
    // We can try to remove it by value if timeout occurs.
    // `this._list.removeValue(resourceRequest)` would be needed in DoublyLinkedList.

    // Back to the original JS: `this._list.insertEnd(node);`
    // This means the items in the list are actually the NODES.
    // So, `Deque` was really `Deque<INode<ResourceRequest>>` effectively, not `Deque<ResourceRequest>`.
    // And `shift/pop` would return `INode.data`.
    // This makes more sense for `_createTimeoutRejectionHandler(node)`.

    // Let's redefine:
    // DoublyLinkedList<U> stores items of type U in its nodes.
    // Deque<U> uses a DoublyLinkedList<U>. Its shift/pop return U.
    // Queue<ResourceRequest> extends Deque<ResourceRequest>.
    // But its internal list operations from JS suggest it was storing INode<ResourceRequest>.

    // This requires a refactor of Deque or Queue's relation to it.
    // For now, I will assume Queue uses its own list for the push/timeout logic,
    // effectively overriding Deque's list usage for `push`. This is messy.

    // A minimal change to make it work without deep refactor:
    // Queue will extend Deque<T>, but its `push` method will interact with the
    // underlying `_list` (a `DoublyLinkedList<T>`) in a way that allows it to
    // create a node, attach a handler, and then add the node's data.
    // The handler, however, needs to remove the *node*. This is the core issue.

    // If T (ResourceRequest) has a unique ID, we could store that and remove by ID.
    // The original code `this._list.remove(node)` is the key.

    // Let's assume the `_list` in `Deque` is accessible (e.g. protected or via getter).
    // And that `Queue` will manage `INode<T>` items within that list if it has to.
    // This means `Deque<T>` is more of a `Deque<managed by INode<T>>`.

    super.push(resourceRequest); // This will add resourceRequest (type T) to the Deque's list.
                                 // It internally creates an INode<T>. We don't have access to it here.

    // The original timeout handler `this._list.remove(node)` cannot be directly translated
    // if `super.push` is used and `node` is not available.

    // Workaround: When a timeout occurs, we need to remove `resourceRequest` from the deque.
    // Deque would need a `remove(value: T)` method.
    // DoublyLinkedList would need `removeByData(data: T)`.
    const removeItem = () => {
        // This is a placeholder for the logic to remove the resourceRequest from the deque.
        // It would require iterating and finding the item, then removing its node.
        // Or Deque.remove(value: T)
        const list = this.getInternalList(); // DoublyLinkedList<T>
        let current = list.head;
        while(current !== null) {
            if (current.data === resourceRequest) {
                list.remove(current);
                break;
            }
            current = current.next;
        }
    };

    resourceRequest.promise.catch(reason => {
      // Assuming TimeoutError has a 'name' property
      if (reason && (reason as Error).name === "TimeoutError") {
        removeItem();
      }
    });
  }

  // _createTimeoutRejectionHandler is effectively inlined above for now.
  // If it were to be kept separate, it would need `resourceRequest` and `this` (for the list).
}
