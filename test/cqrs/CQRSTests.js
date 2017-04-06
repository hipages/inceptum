const { CQRS } = require('../../src/cqrs/CQRS');
const { Auth } = require('../../src/auth/Auth');
const { InMemoryAggregateEventStore } = require('../../src/cqrs/event/InMemoryAggregateEventStore');
const { CreateTodoCommand, MarkTodoDoneCommand } = require('./TodoExample');
const UUID = require('uuid');

const cqrs = new CQRS(new InMemoryAggregateEventStore());
const issuerAuth = new Auth('user', 'userId1', ['registered']);

describe('cqrs', () => {
  describe('Can execute command', () => {
    it('Creates a Todo when the command is executed', () => {
      const aggregateId = UUID.v4();
      cqrs.executeCommand(CreateTodoCommand.fromObject({ aggregateId, issuerAuth, title: 'Test title', description: 'Test description' }));
      const aggregate = cqrs.getAggregate(aggregateId);
      aggregate.title.must.equal('Test title');
      aggregate.description.must.equal('Test description');
      aggregate.status.must.equal('NotDone');
    });
    it('Validates the command on execution', () => {
      const aggregateId = UUID.v4();
      try {
        cqrs.executeCommand(CreateTodoCommand.fromObject({ aggregateId, issuerAuth, title: 'Test title' }));
        true.must.be.falsy();
      } catch (e) {
        e.must.be.an.error('Need to specify a description for the Todo');
      }
    });
    it('Can be marked as done', () => {
      const aggregateId = UUID.v4();
      const executionContext = cqrs.newExecutionContext();
      executionContext.addCommandToExecute(CreateTodoCommand.fromObject({
        aggregateId,
        issuerAuth,
        title: 'Test title',
        description: 'Test description' }));
      executionContext.addCommandToExecute(MarkTodoDoneCommand.fromObject({ aggregateId, issuerAuth }));
      executionContext.commit();
      const aggregate = cqrs.getAggregate(aggregateId);
      aggregate.title.must.equal('Test title');
      aggregate.description.must.equal('Test description');
      aggregate.status.must.equal('Done');
    });
    it('Aggregates survive execution contexts', () => {
      const aggregateId = UUID.v4();
      const executionContext = cqrs.newExecutionContext();
      executionContext.addCommandToExecute(CreateTodoCommand.fromObject({
        aggregateId,
        title: 'Test title',
        issuerAuth,
        description: 'Test description'
      }));
      executionContext.commit();
      const aggregate = cqrs.getAggregate(aggregateId);
      aggregate.title.must.equal('Test title');
      aggregate.description.must.equal('Test description');
      aggregate.status.must.equal('NotDone');
      const executionContext2 = cqrs.newExecutionContext();
      executionContext2.addCommandToExecute(MarkTodoDoneCommand.fromObject({ aggregateId, issuerAuth }));
      executionContext2.commit();
      const aggregate2 = cqrs.getAggregate(aggregateId);
      aggregate2.title.must.equal('Test title');
      aggregate2.description.must.equal('Test description');
      aggregate2.status.must.equal('Done');
    });
    it('Only the creator can mark the TODO as done', () => {
      const aggregateId = UUID.v4();
      const executionContext = cqrs.newExecutionContext();
      executionContext.addCommandToExecute(CreateTodoCommand.fromObject({
        aggregateId,
        title: 'Test title',
        issuerAuth,
        description: 'Test description'
      }));
      executionContext.commit();

      const issuerAuth2 = new Auth('user', 'other', ['registered']);

      const executionContext2 = cqrs.newExecutionContext();
      executionContext2.addCommandToExecute(MarkTodoDoneCommand.fromObject({ aggregateId, issuerAuth: issuerAuth2 }));
      try {
        executionContext2.commit();
        true.must.be.falsy();
      } catch (e) {
        e.must.be.an.error('Only the creator of the Todo can mark it as done');
      }
    });
  });
});
