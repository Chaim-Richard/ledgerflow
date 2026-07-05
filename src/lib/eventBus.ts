type SubscriptionCallback<T = any> = (data: T) => void;

class EventBus {
  private listeners: Record<string, SubscriptionCallback[]> = {};

  /**
   * Register a subscriber for an event. Returns a function to unsubscribe.
   */
  public subscribe<T = any>(event: string, callback: SubscriptionCallback<T>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  /**
   * Broadcast/Publish an event with structured data.
   */
  public publish<T = any>(event: string, data: T): void {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error(`Error executing event listener for event "${event}":`, err);
      }
    });
  }
}

export const globalEventBus = new EventBus();
