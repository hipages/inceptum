const { Event } = require('../../../src/cqrs/event/Event');

describe('cqrs/event/Event', () => {
  describe('Creation', () => {
    it('Copies properties from the provided object', () => {
      const event = new Event({ issuerCommandId: 'TheCommandId', eventId: 'TheEventId' });
      event.getEventId().must.be.equal('TheEventId');
      event.getIssuerCommandId().must.be.equal('TheCommandId');
    });
    it('Calls the factory when a value is not passed', () => {
      const event = new Event({ issuerCommandId: 'TheCommandId' });
      event.getEventId().must.not.be.falsy();
    });
  });
});
