class AggregateEventStore {
  /**
   * Load all the events of an aggregate
   * @param {string} aggregateId The id of the aggregate whose events we want to load
   * @returns {AggregateEvent[]} The list of aggregate events of this aggregate
   */
// eslint-disable-next-line no-unused-vars
  getEventsOf(aggregateId) {
    throw new Error('Not Implemented');
  }
  /**
   * Saves an aggregate event to the persistent store
   * @param {aggregateEvent} aggregateEvent The aggregate event to store
   */
// eslint-disable-next-line no-unused-vars
  commitEvent(aggregateEvent) {
    throw new Error('Not Implemented');
  }
  /**
   * Saves a list of aggregate events to the persistent store
   * @param {aggregateEvent[]} aggregateEvents The array of aggregate events to store
   */
  commitAllEvents(aggregateEvents) {
    aggregateEvents.forEach((event) => this.commitEvent(event));
  }
}

module.exports = { AggregateEventStore };
