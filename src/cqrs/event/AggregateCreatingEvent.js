const { AggregateEvent } = require('./AggregateEvent');

class AggregateCreatingEvent extends AggregateEvent {
  constructor(aggregateType, aggregateId, issuerCommandId, eventId) {
    super(aggregateId, issuerCommandId, eventId);
    this.aggregateType = aggregateType;
  }
  getAggregateType() {
    return this.aggregateType;
  }
}

module.exports = { AggregateCreatingEvent };
