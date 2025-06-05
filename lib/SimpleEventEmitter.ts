type Listener = (...args: any[]) => void;

export class SimpleEventEmitter {
  private _events: Map<string, Listener[]> = new Map();

  public on(eventName: string, listener: Listener): void {
    if (!this._events.has(eventName)) {
      this._events.set(eventName, []);
    }
    this._events.get(eventName)!.push(listener);
  }

  public off(eventName: string, listener: Listener): void {
    if (!this._events.has(eventName)) {
      return;
    }
    const listeners = this._events.get(eventName)!;
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
      if (listeners.length === 0) {
        this._events.delete(eventName);
      }
    }
  }

  public emit(eventName: string, ...args: any[]): void {
    if (!this._events.has(eventName)) {
      return;
    }
    // Iterate over a copy of the listeners array in case a listener modifies the array during emit
    const listeners = [...this._events.get(eventName)!];
    listeners.forEach(listener => {
      listener(...args);
    });
  }
}
