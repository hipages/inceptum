const { Event } = require('./Event');

class AggregateEvent extends Event {
  constructor(obj) {
    super(obj);
    this.copyFrom(obj, ['aggregateId']);
  }
  getAggregateId() {
    return this.aggregateId;
  }
// eslint-disable-next-line no-unused-vars
  apply(aggregate) {
    throw new Error('Not implemented');
  }
}

Event.registerEventClass(AggregateEvent);

module.exports = { AggregateEvent };
