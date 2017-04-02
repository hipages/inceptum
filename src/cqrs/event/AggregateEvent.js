const { Event } = require('./Event');

class AggregateEvent extends Event {
  constructor(aggregateId, issuerCommandId, eventId) {
    super(issuerCommandId, eventId);
    this.aggregateId = aggregateId;
  }
  getAggregateId() {
    return this.aggregateId;
  }
// eslint-disable-next-line no-unused-vars
  apply(aggregate) {
    throw new Error('Not implemented');
  }
}

module.exports = { AggregateEvent };
