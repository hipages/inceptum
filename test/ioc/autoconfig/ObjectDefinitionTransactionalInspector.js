const { ObjectDefinitionTransactionalInspector } = require('../../../src/ioc/autoconfig/ObjectDefinitionTransactionalInspector');
const { TransactionManager } = require('../../../src/transaction/TransactionManager');
const { Context } = require('../../../src/ioc/Context');

class TestClass {
  nonTransactional() {
    TransactionManager.transactionExists().must.be.false();
  }
  readonlyMethod() {
    TransactionManager.transactionExists().must.be.true();
    const currentTransaction = TransactionManager.getCurrentTransaction();
    currentTransaction.isReadonly().must.be.true();
  }
  readwriteMethod() {
    TransactionManager.transactionExists().must.be.true();
    const currentTransaction = TransactionManager.getCurrentTransaction();
    currentTransaction.isReadonly().must.be.false();
  }
}

TestClass.transactional = {
  readonlyMethod: 'readonly',
  readwriteMethod: 'readwrite'
};


describe('ioc/autoconfig/ObjectDefinitionTransactionalInspector', () => {
  describe('transactional wrapping', () => {
    it('non transactional method has no transaction', function* () {
      const inspector = new ObjectDefinitionTransactionalInspector();
      const myContext = new Context('test context');
      myContext.addObjectDefinitionInspector(inspector);
      myContext.registerSingletons(TestClass);

      yield myContext.lcStart();
      const myTestClassInstance = yield* myContext.getObjectByName('TestClass');
      myTestClassInstance.nonTransactional();
      yield myContext.lcStop();
    });
    it('readonly method has a readonly transaction', function* () {
      const inspector = new ObjectDefinitionTransactionalInspector();
      const myContext = new Context('test context');
      myContext.addObjectDefinitionInspector(inspector);
      myContext.registerSingletons(TestClass);

      yield myContext.lcStart();
      const myTestClassInstance = yield* myContext.getObjectByName('TestClass');
      myTestClassInstance.readonlyMethod();
      yield myContext.lcStop();
    });
    it('readwrite method has a readwrite transaction', function* () {
      const inspector = new ObjectDefinitionTransactionalInspector();
      const myContext = new Context('test context');
      myContext.addObjectDefinitionInspector(inspector);
      myContext.registerSingletons(TestClass);

      yield myContext.lcStart();
      const myTestClassInstance = yield* myContext.getObjectByName('TestClass');
      myTestClassInstance.readwriteMethod();
      yield myContext.lcStop();
    });
  });
});
