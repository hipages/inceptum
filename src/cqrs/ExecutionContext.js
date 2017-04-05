const { Aggregate } = require('./Aggregate');
const { AggregateEvent } = require('./event/AggregateEvent');
const { AggregateCommand } = require('./command/AggregateCommand');
const { AggregateEventStore } = require('./event/AggregateEventStore');
const { AggregateCreatingEvent } = require('./event/AggregateCreatingEvent');
const { AggregateCreatingCommand } = require('./command/AggregateCreatingCommand');

const Status = {
  NOT_COMMMITED: 1,
  COMMITTING: 2,
  COMMITTED: 3
};

class ExecutionContext extends AggregateEventStore {
  /**
   * Constructs a new instance of ExecutionContext
   * @param {AggregateEventStore} aggregateEventStore The store to commit events to
   */
  constructor(aggregateEventStore) {
    super();
    this.aggregateEventStore = aggregateEventStore;
    this.status = Status.NOT_COMMMITED;
    this.eventsToEmit = [];
    this.commandsToExecute = [];
    this.error = null;
    // this.aggregateCache = new Map();
  }
  /**
   * Saves an aggregate event to this execution context.
   * The events won't be really saved on the aggregateEventStore until all
   * commands have been executed and the execution has been successful.
   * @param {aggregateEvent} aggregateEvent The aggregate event to store
   */
  commitEvent(event) {
    this.validateNotCommitted();
    if (event && (event instanceof AggregateEvent)) {
      this.eventsToEmit.push(event);
      // this.aggregateCache.delete(event.getAggregateId());
      return;
    }
    throw new Error('Provided event is not of type AggregateEvent');
  }
  /**
   * Adds a command to the queue of commands to be executed.
   * @param {AggregateCommand} aggregateCommand The command to add to the execution queue
   */
  addCommandToExecute(aggregateCommand) {
    this.validateNotCommitted();
    this.commandsToExecute.push(aggregateCommand);
  }
  /**
   * Validates that this execution context has not been committed yet.
   * @private
   */
  validateNotCommitted() {
    if (this.status >= Status.COMMITTED) {
      throw new Error('ExecutionContext is already committed. Can\'t perform additional actions');
    }
  }
  getAggregate(aggregateId) {
    // if (this.aggregateCache.has(aggregateId)) {
    //   return this.aggregateCache.get(aggregateId);
    // }
    const aggregateEvents = this.aggregateEventStore.getEventsOf(aggregateId) || [];
    const uncommittedEvents = this.getUncommittedEventsOf(aggregateId) || [];
    const allEvents = aggregateEvents.concat(uncommittedEvents);
    if (allEvents.length === 0) {
      return null;
    }
    const firstEvent = allEvents[0];
    if (!(firstEvent instanceof AggregateCreatingEvent)) {
      throw new Error(`The first event of aggregate ${aggregateId} is not an AggregateCreatingEvent. Panic!`);
    }
    const aggregate = new Aggregate(firstEvent.getAggregateType(), firstEvent.getAggregateId());
    allEvents.forEach((e) => e.apply(aggregate));
    // this.aggregateCache.set(aggregateId, aggregate);
    return aggregate;
  }
  /**
   * Get all uncommitted events for the given aggregate id
   * @private
   * @param {string} aggregateId The id of the aggregate
   */
  getUncommittedEventsOf(aggregateId) {
    return this.eventsToEmit.filter((e) => e.getAggregateId() === aggregateId);
  }
  /**
   * Executes a single command. This is a convenience method that calls both {@link addCommandToExecute} and
   * {@link commit}
   * @param {AggregateCommand} command The command to execute
   */
  executeCommand(command) {
    this.validateNotCommitted();
    this.addCommandToExecute(command);
    this.commit();
  }
  /**
   * Commits the execution context.
   * This essentially will go through all commands pending execution and will call them in order. It will
   * fail on the first error that gets thrown by any of the commands, and this won't be able to be committed.
   */
  commit() {
    this.validateNotCommitted();
    if (this.status === Status.COMMITTING) {
      throw new Error('ExecutionContext is already committing. Don\'t call commit directly, just call addCommandToExecute');
    }
    this.status = Status.COMMITTING;
    while (this.commandsToExecute.length > 0) {
      const command = this.commandsToExecute.shift();
      let aggregate;
      if ((command instanceof AggregateCommand) && !(command instanceof AggregateCreatingCommand)) {
        aggregate = this.getAggregate(command.getAggregateId());
      }
      try {
        command.execute(this, aggregate);
      } catch (e) {
        this.committed = true;
        this.error = new Error('There was an error executing command');
        this.error.command = command;
        this.error.cause = e;
        throw e;
      }
    }
    // All commands executed correctly
    this.status = Status.COMMITTED;
    try {
      this.aggregateEventStore.commitAllEvents(this.eventsToEmit);
    } catch (e) {
      this.error = new Error('There was an error saving events');
      this.error.cause = e;
      throw e;
    }
  }
  getError() {
    return this.error;
  }
}

module.exports = { ExecutionContext };
