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
    const eventStrArr = this.store.get(aggregateId);
    if (!eventStrArr || eventStrArr.length === 0) {
      return [];
    }
    return eventStrArr.map((element) => this.deserialize(element), this);
  }
  /**
   * Saves an aggregate event to the persistent store
   * @param {AggregateEvent} aggregateEvent The aggregate event to store
   */
// eslint-disable-next-line no-unused-vars
  commitEvent(aggregateEvent) {
    // console.log(JSON.stringify(aggregateEvent));
    const aggregateId = aggregateEvent.getAggregateId();
    if (!this.store.has(aggregateId)) {
      const events = [];
      events.push(this.serialize(aggregateEvent));
      this.store.set(aggregateId, events);
    } else {
      const events = this.store.get(aggregateId);
      events.push(this.serialize(aggregateEvent));
    }
  }
}

module.exports = { InMemoryAggregateEventStore };
