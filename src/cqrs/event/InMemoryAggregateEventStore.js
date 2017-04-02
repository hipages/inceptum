const { AggregateEventStore } = require('./AggregateEventStore');

class InMemoryAggregateEventStore extends AggregateEventStore {
  constructor() {
    super();
    this.store = new Map();
  }
  /**
   * Load all the events of an aggregate
   * @param {string} aggregateId The id of the aggregate whose events we want to load
   * @returns {AggregateEvent[]} The list of aggregate events of this aggregate
   */
// eslint-disable-next-line no-unused-vars
  getEventsOf(aggregateId) {
    return this.store.get(aggregateId);
  }
  /**
   * Saves an aggregate event to the persistent store
   * @param {AggregateEvent} aggregateEvent The aggregate event to store
   */
// eslint-disable-next-line no-unused-vars
  commitEvent(aggregateEvent) {
    const aggregateId = aggregateEvent.getAggregateId();
    if (!this.store.has(aggregateId)) {
      const events = [];
      events.push(aggregateEvent);
      this.store.set(aggregateId, events);
    } else {
      const events = this.store.get(aggregateId);
      events.push(aggregateEvent);
    }
  }
}

module.exports = { InMemoryAggregateEventStore };
