const { ObjectDefinitionTransactionalInspector } = require('../../../src/ioc/autoconfig/ObjectDefinitionTransactionalInspector');
const { Context } = require('../../../src/ioc/Context');
const { TransactionManager } = require('../../../src/transaction/TransactionManager');
const demand = require('must');

class TestClass {
  nonTransactional() {
    demand(TransactionManager.getCurrentTransaction()).is.falsy();
  }
  readonlyMethod() {
    demand(TransactionManager.getCurrentTransaction()).is.not.falsy();
    TransactionManager.getCurrentTransaction().isReadonly().must.be.true();
  }
  readwriteMethod() {
    demand(TransactionManager.getCurrentTransaction()).is.not.falsy();
    TransactionManager.getCurrentTransaction().isReadonly().must.be.false();
  }
}

TestClass.transactional = {
  readonlyMethod: 'readonly',
  readwriteMethod: 'readwrite'
};


function createBasicContext() {
  const inspector = new ObjectDefinitionTransactionalInspector();
  const myContext = new Context('test context');
  myContext.addObjectDefinitionInspector(inspector);
  myContext.registerSingletons(TestClass);

  return myContext;
}

describe('ioc/autoconfig/ObjectDefinitionTransactionalInspector', () => {
  describe('transactional wrapping', () => {
    it('non transactional method has no transaction', () => {
      const myContext = createBasicContext();
      return myContext.lcStart()
        .then(() => myContext.getObjectByName('TestClass'))
        .then((myTestClassInstance) =>
          myTestClassInstance.nonTransactional())
        .then(() => myContext.lcStop());
    });
    it('readonly method has a readonly transaction', () => {
      const myContext = createBasicContext();
      return myContext.lcStart()
        .then(() => myContext.getObjectByName('TestClass'))
        .then((myTestClassInstance) => myTestClassInstance.readonlyMethod())
        .then(() => myContext.lcStop());
    });
    it('readwrite method has a readwrite transaction', () => {
      const myContext = createBasicContext();
      return myContext.lcStart()
        .then(() => myContext.getObjectByName('TestClass'))
        .then((myTestClassInstance) => myTestClassInstance.readwriteMethod())
        .then(() => myContext.lcStop());
    });
  });
});
