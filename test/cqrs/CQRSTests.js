const { CQRS } = require('../../src/cqrs/CQRS');
const { InMemoryAggregateEventStore } = require('../../src/cqrs/event/InMemoryAggregateEventStore');
const { CreateTodoCommand } = require('./TodoExample');
const UUID = require('uuid');

const cqrs = new CQRS(new InMemoryAggregateEventStore());

describe('cqrs', () => {
  describe('Can execute command', () => {
    it('Creates a Todo when the command is executed', () => {
      const aggregateId = UUID.v4();
      cqrs.executeCommand(CreateTodoCommand.fromObject({ aggregateId, title: 'Test title', description: 'Test description' }));
      const aggregate = cqrs.getAggregate(aggregateId);
      aggregate.title.must.equal('Test title');
      aggregate.description.must.equal('Test description');
    });
    it('Validates the command on execution', () => {
      const aggregateId = UUID.v4();
      try {
        cqrs.executeCommand(CreateTodoCommand.fromObject({ aggregateId, title: 'Test title' }));
        true.must.be.falsy();
      } catch (e) {
        e.must.be.an.error('Need to specify a description for the Todo');
      }
    });
  });
});
