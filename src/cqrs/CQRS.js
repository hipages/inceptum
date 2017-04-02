const { ExecutionContext } = require('./ExecutionContext');
const { Aggregate } = require('./Aggregate');
const { AggregateCreatingEvent } = require('./event/AggregateCreatingEvent');

class CQRS {
  /**
   * Construct a new instance of the CQRS framework
   * @param {AggregateEventStore} aggregateEventStore The event store to use.
   */
  constructor(aggregateEventStore) {
    this.aggregateEventStore = aggregateEventStore;
  }
  newExecutionContext() {
    return new ExecutionContext(this.aggregateEventStore);
  }
  executeCommand(command) {
    const executionContext = this.newExecutionContext();
    executionContext.executeCommand(command);
  }
  getAggregate(aggregateId) {
    const allEvents = this.aggregateEventStore.getEventsOf(aggregateId);
    if (allEvents.length === 0) {
      return null;
    }
    const firstEvent = allEvents[0];
    if (!(firstEvent instanceof AggregateCreatingEvent)) {
      throw new Error(`The first event of aggregate ${aggregateId} is not an AggregateCreatingEvent. Panic!`);
    }
    const aggregate = new Aggregate(firstEvent.getAggregateType(), firstEvent.getAggregateId());
    allEvents.forEach((e) => e.apply(aggregate));
    return aggregate;
  }
}

module.exports = { CQRS };
