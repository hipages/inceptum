const { IdGenerator } = require('../IdGenerator');

const eventTypeField = '@eventType';

class Event {
  constructor(obj) {
    this.copyFrom(obj, ['issuerCommandId', 'eventId'], { eventId: IdGenerator.generate });
    this[eventTypeField] = this.constructor.name;
  }
  getEventId() {
    return this.eventId;
  }
  getIssuerCommandId() {
    return this.issuerCommandId;
  }
  copyFrom(from, properties, defaults) {
    properties.forEach((p) => {
      if (Object.hasOwnProperty.call(from, p)) {
        this[p] = from[p];
      } else if (defaults && Object.hasOwnProperty.call(defaults, p)) {
        if (defaults[p] instanceof Function) {
          this[p] = defaults[p]();
        } else {
          this[p] = defaults[p];
        }
      }
    });
  }
  static registerEventClass(eventClass) {
    Event.eventClasses.set(eventClass.name, eventClass);
    eventClass.registerEventClass = Event.registerEventClass;
  }
  static fromObject(obj) {
    if (!Object.hasOwnProperty.call(obj, eventTypeField)) {
      throw new Error(`Can't deserialise object into typed instance because it doesn't have an ${eventTypeField} field`);
    }
    const type = obj[eventTypeField];
    if (!Event.eventClasses.has(type)) {
      throw new Error(`Unknown event type ${type}`);
    }
    const typeConstructor = Event.eventClasses.get(type);
// eslint-disable-next-line new-cap
    return new typeConstructor(obj);
  }
}

Event.eventClasses = new Map();

module.exports = { Event };
