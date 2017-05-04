const { AggregateEvent } = require('./AggregateEvent');

class AggregateCreatingEvent extends AggregateEvent {
  constructor(obj) {
    super(obj);
    this.copyFrom(obj, ['aggregateType']);
  }
  getAggregateType() {
    return this.aggregateType;
  }
}

AggregateEvent.registerEventClass(AggregateCreatingEvent);

module.exports = { AggregateCreatingEvent };
