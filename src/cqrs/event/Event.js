const uuid = require('uuid');

class Event {
  constructor(issuerCommandId, eventId) {
    this.issuerCommandId = issuerCommandId;
    this.eventId = eventId || uuid.v4();
  }
  getEventId() {
    return this.eventId;
  }
  getIssuerCommandId() {
    return this.issuerCommandId;
  }
}

module.exports = { Event };
